import os
import tempfile

import numpy as np
import pymupdf
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


# =========================================================
# CertChain AI - Forgery Detection Service
# =========================================================

app = FastAPI(
    title="CertChain AI Forgery Detection Service",
    version="1.0.0",
)


# =========================================================
# Configuration
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "model",
    "certificate_forgery_model.keras",
)

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads",
)

IMAGE_SIZE = (224, 224)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "application/pdf",
}


# =========================================================
# Global model
# =========================================================

_model = None


# =========================================================
# Load TensorFlow model
# =========================================================

def load_model_if_available():
    global _model

    if _model is None and os.path.isfile(MODEL_PATH):
        print("Loading CertChain AI model...")

        _model = tf.keras.models.load_model(
            MODEL_PATH
        )

        print(
            "CertChain AI model loaded successfully."
        )

    return _model


# =========================================================
# AI MODEL ANALYSIS
# =========================================================

def analyze_with_model(image: Image.Image):

    model = load_model_if_available()

    if model is None:
        return None

    # -----------------------------------------------------
    # Convert image to RGB
    # -----------------------------------------------------

    image = image.convert("RGB")

    # -----------------------------------------------------
    # Resize to MobileNetV2 input size
    # -----------------------------------------------------

    image = image.resize(
        IMAGE_SIZE
    )

    # -----------------------------------------------------
    # Convert image to NumPy array
    # -----------------------------------------------------

    array = np.asarray(
        image,
        dtype=np.float32,
    )

    # -----------------------------------------------------
    # IMPORTANT:
    #
    # The training pipeline used:
    #
    # MobileNetV2 preprocess_input()
    #
    # Apply the same preprocessing during inference.
    # -----------------------------------------------------

    array = tf.keras.applications.mobilenet_v2.preprocess_input(
        array
    )

    # -----------------------------------------------------
    # Add batch dimension
    # -----------------------------------------------------

    array = np.expand_dims(
        array,
        axis=0,
    )

    # -----------------------------------------------------
    # Run prediction
    # -----------------------------------------------------

    probability = float(
        model.predict(
            array,
            verbose=0,
        )[0][0]
    )

    # -----------------------------------------------------
    # Keep probability within 0-1
    # -----------------------------------------------------

    probability = max(
        0.0,
        min(
            1.0,
            probability,
        ),
    )

    return probability


# =========================================================
# Development fallback
# =========================================================
#
# Used only if the trained model is unavailable.
#
# This is NOT the real AI forgery detector.
# =========================================================

def development_fallback(
    image: Image.Image,
):

    image = image.convert("RGB")

    array = np.asarray(
        image,
        dtype=np.float32,
    )

    brightness = float(
        np.mean(array)
    )

    contrast = float(
        np.std(array)
    )

    if contrast < 20:

        forgery_probability = 0.60

    elif (
        brightness < 35
        or brightness > 245
    ):

        forgery_probability = 0.45

    else:

        forgery_probability = 0.20

    return forgery_probability


# =========================================================
# Classification
# =========================================================

def classify_probability(
    forgery_probability: float,
):

    if forgery_probability >= 0.70:

        return "forged"

    if forgery_probability >= 0.30:

        return "suspicious"

    return "genuine"


# =========================================================
# Confidence calculation
# =========================================================

def calculate_confidence(
    probability: float,
    prediction: str,
):

    if prediction == "forged":

        confidence = probability

    elif prediction == "genuine":

        confidence = 1.0 - probability

    else:

        confidence = (
            1.0
            - abs(
                probability - 0.50
            ) * 2
        )

    return max(
        0.0,
        min(
            1.0,
            confidence,
        ),
    )


# =========================================================
# Health endpoint
# =========================================================

@app.get("/health")
async def health():

    model_available = os.path.isfile(
        MODEL_PATH
    )

    return {
        "success": True,
        "service": "certchain-ai",
        "status": "healthy",
        "model_available": model_available,
        "model": (
            "certificate_forgery_model"
            if model_available
            else "development_fallback"
        ),
    }


# =========================================================
# Certificate analysis endpoint
# =========================================================

@app.post("/analyze")
async def analyze_certificate(
    file: UploadFile = File(...),
):

    # -----------------------------------------------------
    # Validate file type
    # -----------------------------------------------------

    if file.content_type not in ALLOWED_TYPES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Upload PDF, JPEG, PNG, WEBP, or BMP."
            ),
        )

    # -----------------------------------------------------
    # Read uploaded file
    # -----------------------------------------------------

    data = await file.read()

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    # -----------------------------------------------------
    # Validate file size
    # -----------------------------------------------------

    if len(data) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=413,
            detail=(
                "File is too large. "
                "Maximum size is 10 MB."
            ),
        )

    # -----------------------------------------------------
    # Ensure upload directory exists
    # -----------------------------------------------------

    os.makedirs(
        UPLOAD_DIR,
        exist_ok=True,
    )

    temp_path = None

    try:

        # -------------------------------------------------
        # Save temporary file
        # -------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".upload",
            dir=UPLOAD_DIR,
        ) as temp_file:

            temp_file.write(data)

            temp_path = temp_file.name

        # -------------------------------------------------
        # Open image or render the first PDF page
        # -------------------------------------------------

        if file.content_type == "application/pdf":

            document = None

            try:
                document = pymupdf.open(
                    stream=data,
                    filetype="pdf",
                )

                if len(document) == 0:
                    raise HTTPException(
                        status_code=400,
                        detail="The uploaded PDF has no pages.",
                    )

                page = document.load_page(0)

                pixmap = page.get_pixmap(
                    matrix=pymupdf.Matrix(2, 2),
                    alpha=False,
                )

                image = Image.frombytes(
                    "RGB",
                    (pixmap.width, pixmap.height),
                    pixmap.samples,
                )

            except HTTPException:
                raise

            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded PDF is invalid or could not be rendered.",
                ) from exc

            finally:
                if document is not None:
                    document.close()

        else:

            try:
                image = Image.open(temp_path)
                image.load()
                image = image.convert("RGB")

            except (
                UnidentifiedImageError,
                OSError,
            ):
                raise HTTPException(
                    status_code=400,
                    detail="The uploaded file is not a valid image.",
                )

        # -------------------------------------------------
        # Analyze using trained model
        # -------------------------------------------------

        probability = analyze_with_model(
            image
        )

        # -------------------------------------------------
        # Fallback if model unavailable
        # -------------------------------------------------

        if probability is None:

            probability = development_fallback(
                image
            )

            model_name = (
                "development_fallback"
            )

            model_status = (
                "development_fallback"
            )

        else:

            model_name = (
                "certificate_forgery_model"
            )

            model_status = "trained"

        # -------------------------------------------------
        # Classification
        # -------------------------------------------------

        prediction = classify_probability(
            probability
        )

        # -------------------------------------------------
        # Confidence
        # -------------------------------------------------

        confidence = calculate_confidence(
            probability,
            prediction
        )

        # -------------------------------------------------
        # Image features
        # -------------------------------------------------

        image_array = np.asarray(
            image.convert("RGB"),
            dtype=np.float32,
        )

        image_brightness = float(
            np.mean(image_array)
        )

        image_contrast = float(
            np.std(image_array)
        )

        image_quality = min(
            1.0,
            max(
                0.0,
                1.0
                - abs(
                    image_contrast - 70
                ) / 100,
            ),
        )

        # -------------------------------------------------
        # Response
        # -------------------------------------------------

        return {

            "success": True,

            "prediction": prediction,

            "forgery_probability": round(
                probability,
                4,
            ),

            "confidence": round(
                confidence,
                4,
            ),

            "model": model_name,

            "model_status": model_status,

            "features": {

                "image_quality": round(
                    image_quality,
                    4,
                ),

                "image_brightness": round(
                    image_brightness / 255.0,
                    4,
                ),

                "image_contrast": round(
                    image_contrast / 128.0,
                    4,
                ),

            },

        }

    finally:

        # -------------------------------------------------
        # Delete temporary file
        # -------------------------------------------------

        if (
            temp_path
            and os.path.exists(temp_path)
        ):

            os.remove(
                temp_path
            )




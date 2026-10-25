import os
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# =========================================================
# CertChain AI - Document Forgery Detection
# Transfer Learning using MobileNetV2
# =========================================================

DATASET_DIR = os.path.join(os.path.dirname(__file__), "dataset")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "model")
MODEL_PATH = os.path.join(MODEL_DIR, "certificate_forgery_model.keras")

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32

# Stage 1: train classification head
HEAD_EPOCHS = 8

# Stage 2: fine-tune upper MobileNetV2 layers
FINE_TUNE_EPOCHS = 12

SEED = 42

# =========================================================
# 1. Dataset folders
# =========================================================

GENUINE_DIR = os.path.join(DATASET_DIR, "genuine")
FORGED_DIR = os.path.join(DATASET_DIR, "forged")

if not os.path.isdir(GENUINE_DIR):
    raise RuntimeError("Genuine dataset folder does not exist.")

if not os.path.isdir(FORGED_DIR):
    raise RuntimeError("Forged dataset folder does not exist.")

# =========================================================
# 2. Count images
# =========================================================

genuine_count = len([
    f
    for f in os.listdir(GENUINE_DIR)
    if os.path.isfile(os.path.join(GENUINE_DIR, f))
])

forged_count = len([
    f
    for f in os.listdir(FORGED_DIR)
    if os.path.isfile(os.path.join(FORGED_DIR, f))
])

total_count = genuine_count + forged_count

if genuine_count < 5 or forged_count < 5:
    raise RuntimeError(
        f"Need at least 5 images in each class. "
        f"Found genuine={genuine_count}, forged={forged_count}."
    )

print("==============================================")
print("CertChain AI Forgery Detection")
print("==============================================")
print(f"Genuine images : {genuine_count}")
print(f"Forged images  : {forged_count}")
print(f"Total images   : {total_count}")
print("==============================================")

# =========================================================
# 3. Load datasets
# =========================================================
#
# VERY IMPORTANT:
#
# genuine = 0
# forged  = 1
#
# Therefore sigmoid output represents forgery probability.
# =========================================================

train_ds = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.20,
    subset="training",
    seed=SEED,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
    class_names=["genuine", "forged"],
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.20,
    subset="validation",
    seed=SEED,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
    class_names=["genuine", "forged"],
)

print("\nClass mapping:")
print("0 = genuine")
print("1 = forged")

print("\nTensorFlow classes:")
print(train_ds.class_names)

# =========================================================
# 4. Dataset performance
# =========================================================

AUTOTUNE = tf.data.AUTOTUNE

train_ds = train_ds.prefetch(AUTOTUNE)
val_ds = val_ds.prefetch(AUTOTUNE)

# =========================================================
# 5. Class weights
# =========================================================
#
# The dataset is:
#
# genuine = 6000
# forged  = 7500
#
# Weight the smaller genuine class slightly higher.
# =========================================================

class_weight = {
    0: total_count / (2.0 * genuine_count),
    1: total_count / (2.0 * forged_count),
}

print("\nClass weights:")
print(f"Genuine: {class_weight[0]:.4f}")
print(f"Forged : {class_weight[1]:.4f}")

# =========================================================
# 6. Data augmentation
# =========================================================

data_augmentation = keras.Sequential(
    [
        layers.RandomRotation(0.02),
        layers.RandomZoom(0.08),
        layers.RandomContrast(0.10),
    ],
    name="document_augmentation",
)

# =========================================================
# 7. MobileNetV2 base model
# =========================================================

base_model = tf.keras.applications.MobileNetV2(
    input_shape=(*IMAGE_SIZE, 3),
    include_top=False,
    weights="imagenet",
)

# Freeze base model during Stage 1.
base_model.trainable = False

# =========================================================
# 8. Build model
# =========================================================

inputs = keras.Input(
    shape=(*IMAGE_SIZE, 3),
    name="certificate_image",
)

x = data_augmentation(inputs)

# MobileNetV2 preprocessing expects pixel values in [-1, 1].
x = tf.keras.applications.mobilenet_v2.preprocess_input(x)

x = base_model(
    x,
    training=False,
)

x = layers.GlobalAveragePooling2D()(x)

x = layers.BatchNormalization()(x)

x = layers.Dropout(0.40)(x)

x = layers.Dense(
    128,
    activation="relu",
)(x)

x = layers.Dropout(0.30)(x)

outputs = layers.Dense(
    1,
    activation="sigmoid",
    name="forgery_probability",
)(x)

model = keras.Model(
    inputs=inputs,
    outputs=outputs,
    name="certchain_forgery_detector",
)

# =========================================================
# 9. Compile Stage 1
# =========================================================

model.compile(
    optimizer=keras.optimizers.Adam(
        learning_rate=0.0003
    ),
    loss="binary_crossentropy",
    metrics=[
        keras.metrics.BinaryAccuracy(
            name="accuracy"
        ),
        keras.metrics.Precision(
            name="precision"
        ),
        keras.metrics.Recall(
            name="recall"
        ),
        keras.metrics.AUC(
            name="auc"
        ),
    ],
)

# =========================================================
# 10. Model directory
# =========================================================

os.makedirs(
    MODEL_DIR,
    exist_ok=True,
)

# =========================================================
# 11. Stage 1 callbacks
# =========================================================

stage1_model_path = os.path.join(
    MODEL_DIR,
    "certificate_forgery_stage1.keras",
)

stage1_callbacks = [
    keras.callbacks.EarlyStopping(
        monitor="val_auc",
        mode="max",
        patience=3,
        restore_best_weights=True,
    ),

    keras.callbacks.ModelCheckpoint(
        stage1_model_path,
        monitor="val_auc",
        mode="max",
        save_best_only=True,
    ),
]

# =========================================================
# 12. Stage 1 training
# =========================================================

print("\n==============================================")
print("STAGE 1: Transfer Learning")
print("==============================================")
print("MobileNetV2 base: FROZEN")
print(f"Epochs: {HEAD_EPOCHS}")
print("==============================================\n")

history_stage1 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=HEAD_EPOCHS,
    class_weight=class_weight,
    callbacks=stage1_callbacks,
)

# =========================================================
# 13. Stage 2 - Fine tuning
# =========================================================

print("\n==============================================")
print("STAGE 2: Fine Tuning")
print("==============================================")

base_model.trainable = True

# Freeze the lower layers.
# Only the upper part of MobileNetV2 will be trained.
fine_tune_from = 100

for layer in base_model.layers[:fine_tune_from]:
    layer.trainable = False

for layer in base_model.layers[fine_tune_from:]:
    layer.trainable = True

print(
    f"Frozen MobileNetV2 layers: first {fine_tune_from}"
)

print(
    f"Trainable MobileNetV2 layers: "
    f"{len(base_model.layers) - fine_tune_from}"
)

# =========================================================
# 14. Recompile with smaller learning rate
# =========================================================

model.compile(
    optimizer=keras.optimizers.Adam(
        learning_rate=0.00001
    ),
    loss="binary_crossentropy",
    metrics=[
        keras.metrics.BinaryAccuracy(
            name="accuracy"
        ),
        keras.metrics.Precision(
            name="precision"
        ),
        keras.metrics.Recall(
            name="recall"
        ),
        keras.metrics.AUC(
            name="auc"
        ),
    ],
)

# =========================================================
# 15. Fine-tuning callbacks
# =========================================================

fine_tune_callbacks = [
    keras.callbacks.EarlyStopping(
        monitor="val_auc",
        mode="max",
        patience=4,
        restore_best_weights=True,
    ),

    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=2,
        min_lr=0.000001,
    ),

    keras.callbacks.ModelCheckpoint(
        MODEL_PATH,
        monitor="val_auc",
        mode="max",
        save_best_only=True,
    ),
]

# =========================================================
# 16. Fine-tune model
# =========================================================

print(f"Fine-tuning epochs: {FINE_TUNE_EPOCHS}")
print("==============================================\n")

history_stage2 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=FINE_TUNE_EPOCHS,
    class_weight=class_weight,
    callbacks=fine_tune_callbacks,
)

# =========================================================
# 17. Final evaluation
# =========================================================

print("\n==============================================")
print("FINAL MODEL EVALUATION")
print("==============================================")

evaluation = model.evaluate(
    val_ds,
    return_dict=True,
)

for name, value in evaluation.items():
    print(f"{name}: {value:.4f}")

# =========================================================
# 18. Save final model
# =========================================================

model.save(MODEL_PATH)

print("\n==============================================")
print("TRAINING COMPLETED")
print("==============================================")
print(f"Final model:")
print(MODEL_PATH)
print("==============================================")

print("\nInterpretation:")
print("0.0 probability = likely genuine")
print("1.0 probability = likely forged")
print("==============================================")
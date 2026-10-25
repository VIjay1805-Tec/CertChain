import os
import random
import numpy as np
import tensorflow as tf
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = False

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, "training", "dataset")
MODEL_DIR = os.path.join(BASE_DIR, "model")
SAMPLE_PER_CLASS = 500
SEED = 42
BATCH_SIZE = 16

random.seed(SEED)
np.random.seed(SEED)

def image_files(folder):
    return [
        os.path.join(folder, name)
        for name in os.listdir(folder)
        if os.path.isfile(os.path.join(folder, name))
        and name.lower().endswith((".png", ".jpg", ".jpeg", ".bmp", ".webp"))
    ]

genuine = image_files(os.path.join(DATASET_DIR, "genuine"))
forged = image_files(os.path.join(DATASET_DIR, "forged"))

if len(genuine) < SAMPLE_PER_CLASS or len(forged) < SAMPLE_PER_CLASS:
    raise RuntimeError("Not enough images to create the requested balanced sample.")

genuine = sorted(random.sample(genuine, SAMPLE_PER_CLASS))
forged = sorted(random.sample(forged, SAMPLE_PER_CLASS))

# Same image list and labels are used for both models.
paths = genuine + forged
labels = np.array([0] * len(genuine) + [1] * len(forged), dtype=np.int32)

def load_batch(batch_paths, size):
    batch = []
    for path in batch_paths:
        with Image.open(path) as image:
            image = image.convert("RGB").resize((size, size))
            batch.append(np.asarray(image, dtype=np.float32))
    x = np.stack(batch)
    return tf.keras.applications.mobilenet_v2.preprocess_input(x)

def auc_score(y_true, scores):
    positives = int(np.sum(y_true == 1))
    negatives = int(np.sum(y_true == 0))
    if positives == 0 or negatives == 0:
        return float("nan")
    order = np.argsort(scores, kind="mergesort")
    sorted_scores = scores[order]
    ranks = np.empty(len(scores), dtype=np.float64)
    i = 0
    while i < len(scores):
        j = i + 1
        while j < len(scores) and sorted_scores[j] == sorted_scores[i]:
            j += 1
        ranks[order[i:j]] = (i + 1 + j) / 2.0
        i = j
    positive_rank_sum = ranks[y_true == 1].sum()
    return float((positive_rank_sum - positives * (positives + 1) / 2) / (positives * negatives))

def evaluate(model_path, size):
    print(f"\nLoading: {os.path.basename(model_path)}")
    model = tf.keras.models.load_model(model_path)
    if tuple(model.input_shape[1:3]) != (size, size):
        raise ValueError(f"Expected {size}x{size} input, got {model.input_shape}")

    scores = []
    for start in range(0, len(paths), BATCH_SIZE):
        batch_paths = paths[start:start + BATCH_SIZE]
        x = load_batch(batch_paths, size)
        prediction = np.asarray(model.predict(x, verbose=0)).reshape(-1)
        scores.extend(prediction.tolist())

    scores = np.clip(np.asarray(scores, dtype=np.float64), 0.0, 1.0)
    predicted = (scores >= 0.5).astype(np.int32)

    tp = int(np.sum((labels == 1) & (predicted == 1)))
    tn = int(np.sum((labels == 0) & (predicted == 0)))
    fp = int(np.sum((labels == 0) & (predicted == 1)))
    fn = int(np.sum((labels == 1) & (predicted == 0)))

    accuracy = (tp + tn) / len(labels)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    print(f"Input size: {size}x{size}")
    print(f"Images evaluated: {len(labels)} (500 genuine, 500 forged)")
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1 score:  {f1:.4f}")
    print(f"ROC-AUC:   {auc_score(labels, scores):.4f}")
    print("Confusion matrix (rows=true genuine/forged, columns=predicted genuine/forged):")
    print(f"[[{tn:4d}, {fp:4d}],")
    print(f" [{fn:4d}, {tp:4d}]]")
    print(f"Mean genuine score: {scores[labels == 0].mean():.4f}")
    print(f"Mean forged score:  {scores[labels == 1].mean():.4f}")

evaluate(
    os.path.join(MODEL_DIR, "certificate_forgery_stage1.keras"),
    384,)
evaluate(
    os.path.join(MODEL_DIR, "certificate_forgery_model_384.keras"),
    384,
)

print("\nEvaluation finished. No model files were modified.")


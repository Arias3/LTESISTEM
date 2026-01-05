# --- IMPORTS ---
import cv2
import time
from flask import Flask, Response, request, jsonify
from ultralytics import YOLO
import threading
import numpy as np

USER = "admin"
PASSWORD = "52418565"
IP = "192.168.1.15"

URL_MAIN = f"rtsp://{USER}:{PASSWORD}@{IP}:554/h264Preview_01_main"
URL_SUB  = f"rtsp://{USER}:{PASSWORD}@{IP}:554/h264Preview_01_sub"

app = Flask(__name__)

frame_global = None
polygon_points = []
people_count = 0
intruders = 0
alert_state = False

# ===== Config =========
current_stream = "main"
output_width = 1280
output_height = 720
current_model_name = "fast"

print("🧠 Cargando modelos...")
models = {
    "fast": YOLO("yolov8n.pt"),     # Más rápido
    "balanced": YOLO("yolov8s.pt"), # Intermedio
    "accurate": YOLO("yolov8m.pt")  # Más preciso
}
model = models["fast"]
print("✅ Modelos listos")


def get_rtsp():
    return URL_MAIN if current_stream == "main" else URL_SUB


def open_camera():
    print("Conectando cámara...")
    rtsp_url = get_rtsp()
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)

    # Limitar buffer para que no se acumule
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    # FPS sugerido
    cap.set(cv2.CAP_PROP_FPS, 15)

    if not cap.isOpened():
        print("❌ No se pudo abrir RTSP")
        return None

    print("✅ RTSP conectado")
    return cap


def point_in_polygon(point, polygon):
    if len(polygon) < 3:
        return False
    polygon_np = np.array(polygon, dtype=np.int32)
    return cv2.pointPolygonTest(polygon_np, point, False) >= 0


def camera_worker():
    global frame_global, people_count, intruders, alert_state, polygon_points
    global current_stream, output_width, output_height, model, current_model_name   
    
    active_stream = current_stream  
    cap = open_camera()
    last_ok = time.time()

    while True:
        # Si el usuario cambió el stream, reiniciamos
        if active_stream != current_stream:
            print("Cambio de stream detectado, reiniciando cámara...")
            active_stream = current_stream
            if cap: cap.release()
            cap = open_camera()
            continue

        ret, frame = cap.read()

        if not ret or frame is None:
            print("Stream perdido, intentando reconectar…")
            if cap: cap.release()
            cap = open_camera()
            continue

        # aplicar resolución elegida
        frame = cv2.resize(frame, (output_width, output_height))

        # ===== DETECCIÓN =====
        results = model(frame, classes=[0], conf=0.5)
        detections = results[0].boxes

        people_count = 0
        intruders = 0
        alert_state = False

        # Zona
        if len(polygon_points) >= 3:
            cv2.polylines(frame, [np.array(polygon_points, dtype=np.int32)], True, (0, 255, 255), 2)

        for box in detections:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            people_count += 1

            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            inside = False
            if len(polygon_points) >= 3:
                inside = point_in_polygon((cx, cy), polygon_points)

            if inside:
                intruders += 1
                alert_state = True
                color = (0, 0, 255)
            else:
                color = (0, 255, 0)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.circle(frame, (cx, cy), 5, color, -1)

        frame_global = frame
        time.sleep(0.02)   # evita CPU al 100%


threading.Thread(target=camera_worker, daemon=True).start()

# ================= STREAM ==================
@app.route("/video")
def video():
    def gen():
        global frame_global
        while True:
            if frame_global is None:
                time.sleep(0.01)
                continue

            ret, jpeg = cv2.imencode(".jpg", frame_global)
            if not ret:
                continue

            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" +
                   jpeg.tobytes() + b"\r\n")

    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")


# ========= POLYGON =========
@app.route("/set_polygon", methods=["POST"])
def set_polygon():
    global polygon_points
    data = request.json
    polygon_points = data.get("points", [])
    return {"status": "ok"}


# ========= STATUS =========
@app.route("/status")
def status():
    return jsonify({
        "people_detected": people_count,
        "intruders": intruders,
        "alert": alert_state,
        "stream": current_stream,
        "model": current_model_name,
        "output": f"{output_width}x{output_height}"
    })


# ========= CONFIG =========
@app.route("/set_config", methods=["POST"])
def set_config():
    global current_stream, output_width, output_height, model, current_model_name

    data = request.json

    if "stream" in data:
        current_stream = data["stream"]

    if "resolution" in data:
        if data["resolution"] == "low":
            output_width, output_height = 640, 360
        elif data["resolution"] == "medium":
            output_width, output_height = 1280, 720
        elif data["resolution"] == "high":
            output_width, output_height = 1920, 1080

    if "model" in data and data["model"] in models:
        current_model_name = data["model"]
        model = models[current_model_name]

    return {"status": "updated"}


# ========= UI =========
@app.route("/")
def index():
    return open("index.html").read()

app.run(host="0.0.0.0", port=5000)

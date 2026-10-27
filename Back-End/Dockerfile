# Usamos una versión ligera de Python
FROM python:3.11-slim

# Le decimos a Docker que trabaje dentro de la carpeta /app
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiamos tu archivo de dependencias y las instalamos
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos todo el resto del código del backend
COPY . .

# Exponer el puerto por defecto (Render asignará PORT automáticamente)
EXPOSE 8000

# Comando para encender FastAPI usando $PORT dinámico si está presente
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

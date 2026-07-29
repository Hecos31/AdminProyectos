# Usamos una versión ligera de Python
FROM python:3.10-slim

# Le decimos a Docker que trabaje dentro de la carpeta /app
WORKDIR /app

# Copiamos tu archivo de dependencias y las instalamos
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos todo el resto del código del backend
COPY . .

# Comando para encender FastAPI (ajusta "main:app" si tu archivo se llama diferente)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
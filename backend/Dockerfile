FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Default environment variables (can be overridden at runtime)
ENV HOST=0.0.0.0
ENV PORT=8000
ENV ALLOWED_ORIGINS=https://your-frontend-domain.com
ENV DEFAULT_NUM_PLAYS=130

# Use Gunicorn with Uvicorn workers for production
CMD exec gunicorn --bind ${HOST}:${PORT} --workers 4 --worker-class uvicorn.workers.UvicornWorker --timeout 120 api:app
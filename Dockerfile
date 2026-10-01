FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock pyproject.toml ./
COPY src ./src
RUN python -m pip install --no-cache-dir -c requirements.lock .
ENV NFLSIM_DATA_DIR=/data
EXPOSE 8000
CMD ["nflsim", "serve", "--host", "0.0.0.0"]

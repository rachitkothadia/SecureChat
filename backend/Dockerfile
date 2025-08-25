FROM node:20-bullseye

# Install Python 3 and pip
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source first (so both installs and builds have files available)
COPY frontend ./frontend
COPY backend ./backend

# Install Node dependencies
RUN npm ci --prefix backend || npm install --prefix backend
RUN npm ci --prefix frontend || npm install --prefix frontend

# Build frontend (output to frontend/dist)
RUN npm run build --prefix frontend

# Install Python dependencies for ML API
RUN pip3 install --no-cache-dir \
    flask \
    flask-cors \
    joblib \
    numpy \
    scikit-learn

# Runtime environment
ENV NODE_ENV=production
ENV ML_PORT=5002
ENV PYTHON_PATH=python3

# Start Node server (which will spawn the Python ML API)
CMD ["node", "backend/src/index.js"]



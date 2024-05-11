FROM python:3.8

WORKDIR /app

RUN apt-get update
RUN apt-get install ffmpeg libsm6 libxext6  -y
RUN apt install -y netcat-traditional
RUN apt install -y telnet
RUN apt-get install -y iputils-ping
RUN pip install torch==1.12.1+cpu torchvision==0.13.1+cpu torchaudio==0.12.1 --extra-index-url https://download.pytorch.org/whl/cpu

RUN pip install opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-flask
RUN pip install minio

COPY ./requirements.txt /app
RUN pip install -r requirements.txt

COPY . /app

WORKDIR /app/iqa

EXPOSE 6789

CMD ["python", "main.py"]

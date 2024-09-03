import json
import os
import csv
import fitz
import openai
import mimetypes
from fpdf import FPDF
from io import StringIO
from docx import Document
from docx.shared import Pt
from datetime import datetime
from django.conf import settings
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse, JsonResponse, FileResponse
from django.core.files.storage import default_storage, FileSystemStorage
from django.core.files.base import ContentFile
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.utils.timezone import now
from .utils import *


messages = [
    {"role": "system", "content": "system message"}
]

uploads_folder = os.path.join(settings.MEDIA_ROOT, 'uploads')
os.makedirs(uploads_folder, exist_ok=True)

messages = []

log_file_path = os.path.join(settings.BASE_DIR, 'log.txt')

def is_ip_logged(ip_address):
    if os.path.exists(log_file_path):
        with open(log_file_path, 'r') as log_file:
            log_data = log_file.readlines()
            
            for line in log_data:
                if f"IP: {ip_address}" in line:
                    return True
    return False

def log_request(request, question):
    ip_address = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT')
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
   
    if not is_ip_logged(ip_address):
        log_entry = f"{current_time} - IP: {ip_address}, User-Agent: {user_agent}, Question: {question}\n"
        with open(log_file_path, 'a') as log_file:
            log_file.write(log_entry)

def login(request):
    context = {
        'page_title': 'Home Page'
    }
    return render(request, 'login.html', context)

@login_required
def home(request):
    return render(request, 'home.html')

def error_handle(request, exception):
    return render(request, '404.html')

@csrf_exempt
def ask_question(request):
    if request.method == 'POST':
        data = json.loads(request.body.decode('utf-8'))
        question = data.get('question', '')
        
        log_request(request, question)

        personality_file = os.path.join(settings.BASE_DIR, 'personality.txt')
        with open(personality_file, "r") as file:
            mode = file.read().strip()

        messages.append({"role": "system", "content": mode})
        messages.append({"role": "user", "content": question})

        completion = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.8
        )

        response_text = completion['choices'][0]['message']['content']
        messages.append({"role": "assistant", "content": response_text})

        return JsonResponse({'response': response_text})
    return JsonResponse({'error': 'Invalid request method'}, status=405)

def file_upload(request):
    if request.method == 'POST':
        file = request.FILES.get('file')

        if not file:
            return JsonResponse({'error': 'No selected file'}, status=400)

        filename = file.name
        file_path = os.path.join(settings.MEDIA_ROOT, filename)
        default_storage.save(filename, ContentFile(file.read()))

        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type == 'application/pdf':
            file_content_data = decode_pdf(file_path)
        elif mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            file_content_data = decode_docx(file_path)
        else:
            file_content_data = decode_default(file_path)

        messages.append({"role": "user", "content": file_content_data[:1000]})

        return JsonResponse({'message': 'File uploaded and processed successfully', 'content': file_content_data[:1000]})

    return JsonResponse({'error': 'Invalid request method'}, status=405)

def export_pdf(request):
    pdf_filename = "conversation.pdf"
    pdf_file_path = os.path.join(settings.MEDIA_ROOT, pdf_filename)
    generate_pdf(messages, pdf_file_path)

    return FileResponse(open(pdf_file_path, 'rb'), as_attachment=True, filename='conversation.pdf', content_type='application/pdf')

def export_docx(request):
    docx_filename = "conversation.docx"
    docx_file_path = os.path.join(settings.MEDIA_ROOT, docx_filename)
    generate_docx(messages, docx_file_path)

    return FileResponse(open(docx_file_path, 'rb'), as_attachment=True, filename='conversation.docx', content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')

def export_csv(request):
    response = messages[-1]['content']
    csv_filename = "data.csv"
    csv_file_path = os.path.join(settings.MEDIA_ROOT, csv_filename)
    generate_csv(response, csv_file_path)

    return FileResponse(open(csv_file_path, 'rb'), as_attachment=True, filename='data.csv', content_type='text/csv')

import os
from django.http import HttpResponse

def frontend_home(request):
    dist_index = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist', 'index.html'))
    if os.path.exists(dist_index):
        with open(dist_index, 'r', encoding='utf-8') as f:
            content = f.read()
        return HttpResponse(content)
    return HttpResponse("""
    <h1>KRGI Academic Audit API & Backend</h1>
    <p>Django backend is running successfully.</p>
    <ul>
        <li><a href='/admin/'>Django Admin Control Center</a></li>
        <li><a href='/api/bootstrap/'>API Bootstrap Endpoint</a></li>
        <li><a href='http://localhost:3000/'>React Frontend Dev Server (port 3000)</a></li>
    </ul>
    """)

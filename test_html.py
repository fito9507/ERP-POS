import sys
from bs4 import BeautifulSoup

with open('test_output.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

inputs = soup.find_all('input')
print("Number of inputs:", len(inputs))
print("Inputs:", [i.get('id') for i in inputs])

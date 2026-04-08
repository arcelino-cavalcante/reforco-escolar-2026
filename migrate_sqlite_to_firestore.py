import sqlite3
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Conectar ao Firebase
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# Conectar ao SQLite
try:
    conn = sqlite3.connect('reforco.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    print("Iniciando Migração do SQLite para o Firestore...")
except Exception as e:
    print(f"Erro ao conectar ao DB local (se for a primeira vez não haverá dados passados): {e}")
    exit()

def get_rows(table):
    try:
        cursor.execute(f"SELECT * FROM {table}")
        return [dict(row) for row in cursor.fetchall()]
    except:
        return []

# Mapear tabelas independentes puxando do Local -> Cloud
print("Migrando Etapas...")
etapas = get_rows('etapas')
for e in etapas:
    id_str = str(e['id'])
    doc_ref = db.collection('etapas').document(id_str)
    doc_ref.set({'nome': e['nome']})

print("Migrando Turmas...")
turmas = get_rows('turmas')
for t in turmas:
    id_str = str(t['id'])
    doc_ref = db.collection('turmas').document(id_str)
    doc_ref.set({'nome': t['nome'], 'etapa_id': str(t['etapa_id'])})

print("Migrando Estudantes...")
estudantes = get_rows('estudantes')
for est in estudantes:
    id_str = str(est['id'])
    doc_ref = db.collection('estudantes').document(id_str)
    # Salvando como number ou str? Melhor como o original (int/1/0)
    doc_ref.set({
        'nome': est['nome'], 
        'turma_id': str(est['turma_id']),
        'ativo': est.get('ativo', 1)
    })

print("Migrando Professores de Reforço...")
profs_ref = get_rows('professores_reforco')
for p in profs_ref:
    id_str = str(p['id'])
    # Precisamos pegar as turmas dele!
    cursor.execute("SELECT turma_id FROM prof_reforco_turmas WHERE prof_id = ?", (p['id'],))
    ts = [str(x[0]) for x in cursor.fetchall()]
    doc_ref = db.collection('professores_reforco').document(id_str)
    doc_ref.set({
        'nome': p['nome'],
        'area': p['area'],
        'turmas_ids': ts
    })

print("Migrando Professores Regentes...")
profs_reg = get_rows('professores_regentes')
for p in profs_reg:
    id_str = str(p['id'])
    cursor.execute("SELECT turma_id FROM prof_regente_turmas WHERE prof_id = ?", (p['id'],))
    ts = [str(x[0]) for x in cursor.fetchall()]
    doc_ref = db.collection('professores_regentes').document(id_str)
    doc_ref.set({
        'nome': p['nome'],
        'area': p['area'],
        'turmas_ids': ts
    })

print("Migrando Registros Diários...")
registros = get_rows('registros_diarios')
for r in registros:
    id_str = str(r['id'])
    doc_ref = db.collection('registros_diarios').document(id_str)
    data = {k: v for k, v in r.items() if k != 'id'}
    # Converter chaves relacionais para str
    data['estudante_id'] = str(data['estudante_id'])
    data['prof_id'] = str(data['prof_id'])
    doc_ref.set(data)

print("Migrando Encaminhamentos...")
encaminhamentos = get_rows('encaminhamentos')
for e in encaminhamentos:
    id_str = str(e['id'])
    doc_ref = db.collection('encaminhamentos').document(id_str)
    data = {k: v for k, v in e.items() if k != 'id'}
    data['estudante_id'] = str(data['estudante_id'])
    data['regente_id'] = str(data['regente_id'])
    doc_ref.set(data)

print("Migrando Consolidados Mensais...")
consolidados = get_rows('consolidados_mensais')
for c in consolidados:
    id_str = str(c['id'])
    doc_ref = db.collection('consolidados_mensais').document(id_str)
    data = {k: v for k, v in c.items() if k != 'id'}
    data['estudante_id'] = str(data['estudante_id'])
    data['prof_id'] = str(data['prof_id'])
    # optional null regente
    if 'prof_regente_id' in data and data['prof_regente_id'] is not None:
        data['prof_regente_id'] = str(data['prof_regente_id'])
    doc_ref.set(data)

print("🚀 MIGRAÇÃO SQLITE -> FIRESTORE CONCLUÍDA COM SUCESSO!")
conn.close()

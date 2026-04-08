import firebase_admin
from firebase_admin import credentials, firestore

import streamlit as st

def init_db():
    try:
        firebase_admin.get_app()
    except ValueError:
        # Tenta carregar dos Secrets do Streamlit (Nuvem) ou Arquivo Local
        if "firebase_json" in st.secrets:
            # Método Infalível: Lê o JSON bruto do segredo e converte em dicionário
            import json
            fb_creds = json.loads(st.secrets["firebase_json"], strict=False)
            cred = credentials.Certificate(fb_creds)
        elif "firebase" in st.secrets:
            # Fallback para o modelo campo-a-campo (caso prefira manter o antigo)
            fb_creds = {k: v for k, v in st.secrets["firebase"].items()}
            if "private_key" in fb_creds:
                raw_key = fb_creds["private_key"].strip().strip('"')
                fb_creds["private_key"] = raw_key.replace("\\n", "\n") if "\\n" in raw_key else raw_key
            cred = credentials.Certificate(fb_creds)
        else:
            # Fallback para desenvolvimento local
            cred = credentials.Certificate('serviceAccountKey.json')
            
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully!")

def get_db():
    init_db()
    return firestore.client()

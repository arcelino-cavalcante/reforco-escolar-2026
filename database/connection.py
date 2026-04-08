import firebase_admin
from firebase_admin import credentials, firestore

import streamlit as st

def init_db():
    try:
        firebase_admin.get_app()
    except ValueError:
        # Tenta carregar dos Secrets do Streamlit (Nuvem) ou Arquivo Local
        if "firebase" in st.secrets:
            # Converte a estrutura do TOML para dicionário de credenciais
            fb_creds = dict(st.secrets["firebase"])
            # Ajuste para a private_key que as vezes precisa de replace de \n
            if "private_key" in fb_creds:
                fb_creds["private_key"] = fb_creds["private_key"].replace("\\n", "\n")
            cred = credentials.Certificate(fb_creds)
        else:
            # Fallback para desenvolvimento local
            cred = credentials.Certificate('serviceAccountKey.json')
            
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully!")

def get_db():
    init_db()
    return firestore.client()

import streamlit as st
from utils.styles import page_header
from database.crud import obter_contexto_ia, salvar_contexto_ia
from views.assistente_ia import build_data_context_text

def render():
    page_header("🧠 Cérebro da IA (Gestão de Contexto)", "Controle estritamente o que a Inteligência Artificial lê e entende sobre a escola.")

    # 1. Obter Base Comprimida CSV
    with st.spinner("Carregando pacotes de dados brutos..."):
        data_text = build_data_context_text()

    # 2. Painel Lateral/Caixas Expansíves
    st.divider()
    st.subheader("⚙️ Diretrizes Personalizadas")
    st.write("Digite ordens pedagógicas, restrições ou a forma como a IA deve conversar com a Coordenação.")
    
    contexto_salvo = obter_contexto_ia()
    novo_contexto = st.text_area(
        "Regras de Ouro da Escola:",
        value=contexto_salvo,
        height=150,
        placeholder="Exemplo: Fale sempre em um tom muito sério. Avise sempre sobre alunos com 2 faltas consecutivas."
    )
    
    if st.button("💾 Salvar na Nuvem", use_container_width=True, type="primary"):
        salvar_contexto_ia(novo_contexto)
        st.success("Diretrizes da IA atualizadas no Firebase com sucesso!")

    st.divider()
    st.subheader("📦 Dados Vivos Otimizados")
    st.write("Estes são os arrays originais convertidos em hiper-compressão **CSV (delimitados por vírgula)** com corte de janela aos últimos 30 dias. Economia altíssima de budget e performance:")
    with st.expander(f"Ver Base CSV do Cérebro ({len(data_text)} caracteres)"):
        st.code(data_text, language="csv")

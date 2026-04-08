import streamlit as st
import datetime
import pandas as pd
from database.crud import obter_estatisticas_coordenacao
from utils.styles import page_header

def render():
    page_header("📈 Dashboard de Metas", "Visão panorâmica do andamento do Reforço Escolar.")
    
    perfil = st.session_state.get('perfil')
    prof_id = st.session_state.get('prof_id')
    
    # ===== DASHBOARD PARA O PROFESSOR DE REFORÇO =====
    if perfil == "reforco" and prof_id:
        from database.crud import obter_estatisticas_reforco
        stats = obter_estatisticas_reforco(prof_id)
        
        st.markdown(f"#### 🎓 Olá, Prof. {st.session_state.prof_nome}!")
        st.info("Aqui estão os seus indicadores de atendimento.")
        
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Total de Meus Alunos", stats['qtd_total_estudantes'])
        with col2:
            st.metric("Alunos Atendidos (Últimos 7 dias)", stats['qtd_atendidos_semana'])
            
        st.divider()
        st.caption("Foque nos atendimentos pendentes para bater as metas de frequência.")
        return

    # ===== DASHBOARD PARA COORDENAÇÃO OU GERAL =====
    hoje = datetime.date.today()
    mes_atual = hoje.month
    ano_atual = hoje.year
    
    st.markdown(f"#### 🔎 Competência Global: {hoje.strftime('%B / %Y').title()}")
    
    stats = obter_estatisticas_coordenacao(mes_atual, ano_atual)
    if not stats:
        st.error("Erro interno ao buscar estatísticas.")
        return

    # CARDS DE METRICAS
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Professores de Reforço", stats['qtd_prof_reforco'])
    with col2:
        st.metric("Professores Regentes", stats['qtd_prof_regente'])
    with col3:
        st.metric("Alunos no Reforço", stats['qtd_total_estudantes'])
    with col4:
        st.metric("Lançamentos (Mês)", stats['qtd_registros_mes'])
        
    st.divider()

    # RESUMO POR ETAPA
    st.subheader("📊 Estudantes por Etapa de Ensino")
    
    dados_etapas = stats['estudantes_por_etapa']
    if not dados_etapas:
        st.info("Nenhum registro de etapa encontrado.")
    else:
        # Exibe os números por etapa lado a lado
        cols_etp = st.columns(len(dados_etapas))
        for i, item in enumerate(dados_etapas):
            with cols_etp[i]:
                st.metric(item['etapa_nome'], item['contagem'])

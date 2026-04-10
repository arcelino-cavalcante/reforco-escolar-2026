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
        st.subheader("📊 Meu Desempenho Visual")
        import plotly.express as px
        
        c_g1, c_g2 = st.columns(2)
        with c_g1:
            atendidos = stats['qtd_atendidos_semana']
            pendentes = stats['qtd_total_estudantes'] - atendidos
            if pendentes < 0: pendentes = 0
            if stats['qtd_total_estudantes'] > 0:
                df_g = pd.DataFrame({'Status': ['Atendidos na Semana', 'Pendentes'], 'Contagem': [atendidos, pendentes]})
                fig = px.pie(df_g, names='Status', values='Contagem', hole=0.5, color_discrete_sequence=['#2ecc71', '#e74c3c'])
                st.plotly_chart(fig, use_container_width=True)
        with c_g2:
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
        cols_etp = st.columns(len(dados_etapas))
        for i, item in enumerate(dados_etapas):
            with cols_etp[i]:
                st.metric(item['etapa_nome'], item['contagem'])

        st.write("<br>", unsafe_allow_html=True)
        st.subheader("📈 Análise Gráfica Global")
        c_g1, c_g2 = st.columns(2)
        
        import plotly.express as px
        with c_g1:
            df_etp = pd.DataFrame(dados_etapas)
            fig_etp = px.bar(df_etp, x='etapa_nome', y='contagem', color='etapa_nome', title="Distribuição por Etapa", text_auto=True)
            st.plotly_chart(fig_etp, use_container_width=True)
            
        with c_g2:
            df_prof = pd.DataFrame({'Cargo': ['Equipe de Reforço', 'Professores Regentes'], 'Quantidade': [stats['qtd_prof_reforco'], stats['qtd_prof_regente']]})
            fig_prof = px.pie(df_prof, names='Cargo', values='Quantidade', hole=0.4, title="Corpo Docente Ativo", color_discrete_sequence=['#3498db', '#9b59b6'])
            st.plotly_chart(fig_prof, use_container_width=True)

import streamlit as st
import datetime
import pandas as pd
from database.crud import (
    obter_estatisticas_coordenacao, obter_estatisticas_reforco,
    obter_turmas_prof_reforco, listar_turmas, listar_estudantes,
    listar_profs_reforco, contar_notificacoes_reforco,
    compreensao_para_nota, compreensao_label, compreensao_emoji
)
from utils.styles import page_header

def render():
    page_header("📈 Dashboard de Metas", "Visão panorâmica do andamento do Reforço Escolar.")
    
    perfil = st.session_state.get('perfil')
    prof_id = st.session_state.get('prof_id')
    
    # ===== DASHBOARD PARA O PROFESSOR DE REFORÇO =====
    if perfil == "reforco" and prof_id:
        _render_dashboard_reforco(prof_id)
        return

    # ===== DASHBOARD PARA COORDENAÇÃO OU GERAL =====
    _render_dashboard_coordenacao()


def _render_dashboard_reforco(prof_id):
    """Dashboard enriquecido para o Professor de Reforço."""
    import plotly.express as px
    from database.crud import listar_registros_diarios_trinta_dias

    stats = obter_estatisticas_reforco(prof_id)
    lista_profs = listar_profs_reforco()
    prof_atual = next((p for p in lista_profs if p['id'] == prof_id), None)
    area_prof = prof_atual.get('area', 'Geral') if prof_atual else 'Geral'
    
    st.markdown(f"#### 🎓 Olá, Prof. {st.session_state.prof_nome}! — *{area_prof}*")
    
    # --- Métricas principais ---
    notif_count = contar_notificacoes_reforco(prof_id)
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total de Meus Alunos", stats['qtd_total_estudantes'])
    with col2:
        st.metric("Atendidos (Últimos 7 dias)", stats['qtd_atendidos_semana'])
    with col3:
        delta_color = "inverse" if notif_count > 0 else "off"
        st.metric("📨 Pedidos do Regente", notif_count, delta="pendentes" if notif_count > 0 else "nenhum", delta_color=delta_color)
    
    st.divider()
    
    # --- Buscar dados dos últimos 30 dias para análises ---
    turmas_ids = obter_turmas_prof_reforco(prof_id)
    todas_turmas = listar_turmas()
    turmas_prof = [t for t in todas_turmas if t['id'] in turmas_ids]
    
    # Coletar todos os registros das turmas do professor
    todos_registros = []
    for t in turmas_prof:
        regs = listar_registros_diarios_trinta_dias(prof_id, t['id'])
        todos_registros.extend(regs)
    
    if not todos_registros:
        st.info("📭 Nenhum registro nos últimos 30 dias. Comece a lançar fichas diárias!")
        return
    
    df = pd.DataFrame(todos_registros)
    
    # --- Gráfico Cobertura + Alertas ---
    col_g1, col_g2 = st.columns(2)
    
    with col_g1:
        st.markdown("##### 📊 Cobertura Semanal")
        atendidos = stats['qtd_atendidos_semana']
        pendentes = max(0, stats['qtd_total_estudantes'] - atendidos)
        if stats['qtd_total_estudantes'] > 0:
            df_g = pd.DataFrame({'Status': ['Atendidos na Semana', 'Pendentes'], 'Contagem': [atendidos, pendentes]})
            fig = px.pie(df_g, names='Status', values='Contagem', hole=0.5, color_discrete_sequence=['#2ecc71', '#e74c3c'])
            fig.update_layout(margin=dict(t=10, b=10), height=250)
            st.plotly_chart(fig, use_container_width=True)
    
    with col_g2:
        st.markdown("##### 🔴 Top 5 — Mais Faltas (30 dias)")
        df_faltas = df[df['compareceu'] == 0]
        if not df_faltas.empty:
            faltas_por_aluno = df_faltas.groupby('estudante_nome').size().reset_index(name='Faltas')
            faltas_por_aluno = faltas_por_aluno.sort_values('Faltas', ascending=False).head(5)
            for _, row in faltas_por_aluno.iterrows():
                st.markdown(f"🔴 **{row['estudante_nome']}** — {row['Faltas']} falta(s)")
        else:
            st.success("🎉 Nenhuma falta registrada nos últimos 30 dias!")
    
    st.divider()
    
    # --- Alunos com desempenho estagnado ---
    col_e1, col_e2 = st.columns(2)
    
    with col_e1:
        st.markdown("##### ⚠️ Alunos Estagnados (Compreensão ≤ 2)")
        df_presentes = df[df['compareceu'] == 1].copy()
        if not df_presentes.empty and 'nivel_compreensao' in df_presentes.columns:
            df_presentes['nota_unif'] = df_presentes['nivel_compreensao'].apply(compreensao_para_nota)
            media_aluno = df_presentes.groupby('estudante_nome')['nota_unif'].mean().reset_index()
            media_aluno.columns = ['Aluno', 'Média']
            estagnados = media_aluno[media_aluno['Média'] <= 2.0].sort_values('Média')
            if not estagnados.empty:
                for _, row in estagnados.iterrows():
                    emoji = compreensao_emoji(round(row['Média']))
                    label = compreensao_label(round(row['Média']))
                    st.markdown(f"{emoji} **{row['Aluno']}** — Média: {row['Média']:.1f}/4 (*{label}*)")
            else:
                st.success("✅ Nenhum aluno com compreensão crítica!")
        else:
            st.info("Sem dados de compreensão para analisar.")
    
    with col_e2:
        st.markdown("##### 📈 Média de Compreensão por Turma")
        if not df_presentes.empty and 'turma_nome' in df_presentes.columns:
            media_turma = df_presentes.groupby('turma_nome')['nota_unif'].mean().reset_index()
            media_turma.columns = ['Turma', 'Média']
            media_turma = media_turma.sort_values('Média', ascending=True)
            fig_turma = px.bar(media_turma, x='Média', y='Turma', orientation='h',
                               color='Média', color_continuous_scale=['#e74c3c', '#f39c12', '#2ecc71'],
                               range_color=[1, 4])
            fig_turma.update_layout(margin=dict(t=10, b=10), height=250, showlegend=False)
            st.plotly_chart(fig_turma, use_container_width=True)
        else:
            st.info("Sem dados suficientes.")
    
    st.divider()
    st.caption("💡 Foque nos alunos estagnados e com muitas faltas para bater suas metas de evolução.")


def _render_dashboard_coordenacao():
    """Dashboard para a Coordenação."""
    import plotly.express as px
    
    hoje = datetime.date.today()
    mes_atual = hoje.month
    ano_atual = hoje.year
    
    # Locale-safe month name in Portuguese
    meses_pt = {1:'Janeiro',2:'Fevereiro',3:'Março',4:'Abril',5:'Maio',6:'Junho',
                7:'Julho',8:'Agosto',9:'Setembro',10:'Outubro',11:'Novembro',12:'Dezembro'}
    st.markdown(f"#### 🔎 Competência Global: {meses_pt[mes_atual]} / {ano_atual}")
    
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
        
        with c_g1:
            df_etp = pd.DataFrame(dados_etapas)
            fig_etp = px.bar(df_etp, x='etapa_nome', y='contagem', color='etapa_nome', title="Distribuição por Etapa", text_auto=True)
            st.plotly_chart(fig_etp, use_container_width=True)
            
        with c_g2:
            df_prof = pd.DataFrame({'Cargo': ['Equipe de Reforço', 'Professores Regentes'], 'Quantidade': [stats['qtd_prof_reforco'], stats['qtd_prof_regente']]})
            fig_prof = px.pie(df_prof, names='Cargo', values='Quantidade', hole=0.4, title="Corpo Docente Ativo", color_discrete_sequence=['#3498db', '#9b59b6'])
            st.plotly_chart(fig_prof, use_container_width=True)

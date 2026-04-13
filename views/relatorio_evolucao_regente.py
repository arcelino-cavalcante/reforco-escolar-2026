import streamlit as st
import datetime
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from database.crud import (
    listar_registros_por_regente, listar_turmas, obter_turmas_prof_regente,
    listar_consolidados_por_regente, listar_estudantes,
    compreensao_para_nota, compreensao_label
)
from utils.styles import page_header


def render():
    page_header("📈 Relatório de Evolução", "Acompanhe graficamente o progresso dos seus alunos no Reforço Escolar.")

    prof_id = st.session_state.get('prof_id')
    if prof_id is None:
        st.error("Acesso negado: Você não está logado como regente.")
        return

    turmas_do_regente_ids = obter_turmas_prof_regente(prof_id)
    todas_turmas = listar_turmas()
    turmas_obj = [t for t in todas_turmas if t['id'] in turmas_do_regente_ids]

    if not turmas_obj:
        st.warning("Você não está lotado(a) em nenhuma turma atualmente.")
        return

    # Filtros
    col_f1, col_f2 = st.columns(2)
    with col_f1:
        turma_nomes = {f"{t['nome']} ({t['etapa_nome']})": t['id'] for t in turmas_obj}
        turma_sel_nome = st.selectbox("Selecione a Turma:", list(turma_nomes.keys()))
        turma_sel_id = turma_nomes[turma_sel_nome]
    with col_f2:
        bim_filtro = st.selectbox("Bimestre:", ["Todos", "I", "II", "III", "IV"])

    # Dados
    dados = listar_registros_por_regente(prof_id, bim_filtro)
    consolidados = listar_consolidados_por_regente(prof_id, bim_filtro)

    # Filtrar pela turma selecionada
    dados_turma = [d for d in dados if d.get('turma_id') == turma_sel_id]
    consolidados_turma = [c for c in consolidados if c.get('estudante_id') in 
                          [d['estudante_id'] for d in dados_turma]]

    if not dados_turma:
        st.info("Nenhum dado de reforço encontrado para esta turma e bimestre selecionados.")
        return

    df = pd.DataFrame(dados_turma)
    df['data_dt'] = pd.to_datetime(df['data_registro'])
    df_presentes = df[df['compareceu'] == 1].copy()

    if not df_presentes.empty and 'nivel_compreensao' in df_presentes.columns:
        df_presentes['nota'] = df_presentes['nivel_compreensao'].apply(compreensao_para_nota)

    st.divider()

    # ==========================================
    # MÉTRICAS GERAIS DA TURMA
    # ==========================================
    st.subheader("📊 Visão Geral da Turma no Reforço")

    total_registros = len(df)
    total_presentes = len(df[df['compareceu'] == 1])
    total_faltas = total_registros - total_presentes
    taxa_presenca = (total_presentes / total_registros * 100) if total_registros > 0 else 0

    alunos_unicos = df['estudante_id'].nunique()
    media_comp = df_presentes['nota'].mean() if not df_presentes.empty and 'nota' in df_presentes.columns else 0
    taxa_autonomia = (df_presentes['nota'].apply(lambda x: 1 if x == 4 else 0).sum() / len(df_presentes) * 100) if not df_presentes.empty and 'nota' in df_presentes.columns else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Alunos Atendidos", alunos_unicos)
    c2.metric("Taxa de Presença", f"{taxa_presenca:.0f}%", help=f"{total_presentes} presenças / {total_faltas} faltas")
    c3.metric("Média Compreensão", f"{media_comp:.1f}/4")
    c4.metric("Autonomia Total", f"{taxa_autonomia:.0f}%", help="% de aulas com domínio total")

    st.write("<br>", unsafe_allow_html=True)

    # ==========================================
    # GRÁFICO 1: EVOLUÇÃO TEMPORAL DA COMPREENSÃO
    # ==========================================
    if not df_presentes.empty and 'nota' in df_presentes.columns:
        st.subheader("📈 Evolução da Compreensão ao Longo do Tempo")
        
        # Média diária de compreensão da turma
        df_evolucao = df_presentes.groupby('data_registro').agg(
            media_nota=('nota', 'mean'),
            qtd_aulas=('nota', 'count')
        ).reset_index()
        df_evolucao = df_evolucao.sort_values('data_registro')

        fig_evolucao = px.line(
            df_evolucao, x='data_registro', y='media_nota',
            markers=True,
            labels={'data_registro': 'Data', 'media_nota': 'Média de Compreensão (1-4)'},
            color_discrete_sequence=['#3498db']
        )
        fig_evolucao.update_yaxes(
            range=[0.5, 4.5],
            tickvals=[1, 2, 3, 4],
            ticktext=["1 - Não comp.", "2 - Muita int.", "3 - Pouca int.", "4 - Autônomo"]
        )
        fig_evolucao.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            margin=dict(l=0, r=0, t=10, b=0),
            height=350
        )
        # Adicionar linha de referência para "autônomo"
        fig_evolucao.add_hline(y=4, line_dash="dot", line_color="green", annotation_text="Meta: Autônomo")
        st.plotly_chart(fig_evolucao, use_container_width=True)

    st.write("<br>", unsafe_allow_html=True)

    # ==========================================
    # GRÁFICO 2: FREQUÊNCIA POR ALUNO
    # ==========================================
    st.subheader("📅 Comparativo de Frequência por Aluno")

    df_freq = df.groupby('estudante_nome').agg(
        presencas=('compareceu', 'sum'),
        total=('compareceu', 'count')
    ).reset_index()
    df_freq['faltas'] = df_freq['total'] - df_freq['presencas']
    df_freq['taxa'] = (df_freq['presencas'] / df_freq['total'] * 100).round(1)
    df_freq = df_freq.sort_values('taxa', ascending=True)

    fig_freq = go.Figure()
    fig_freq.add_trace(go.Bar(
        y=df_freq['estudante_nome'],
        x=df_freq['presencas'],
        name='Presenças',
        orientation='h',
        marker_color='#2ecc71',
        text=df_freq['presencas'],
        textposition='inside'
    ))
    fig_freq.add_trace(go.Bar(
        y=df_freq['estudante_nome'],
        x=df_freq['faltas'],
        name='Faltas',
        orientation='h',
        marker_color='#e74c3c',
        text=df_freq['faltas'],
        textposition='inside'
    ))
    fig_freq.update_layout(
        barmode='stack',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        height=max(250, len(df_freq) * 40),
        margin=dict(l=0, r=0, t=10, b=0),
        legend=dict(orientation='h', yanchor='bottom', y=1.02)
    )
    st.plotly_chart(fig_freq, use_container_width=True)

    st.write("<br>", unsafe_allow_html=True)

    # ==========================================
    # GRÁFICO 3: RANKING DE DESEMPENHO POR ALUNO
    # ==========================================
    if not df_presentes.empty and 'nota' in df_presentes.columns:
        st.subheader("🏆 Ranking de Desempenho dos Alunos")

        df_ranking = df_presentes.groupby('estudante_nome').agg(
            media_comp=('nota', 'mean'),
            total_aulas=('nota', 'count'),
            autonomias=('nota', lambda x: (x == 4).sum())
        ).reset_index()
        df_ranking['taxa_autonomia'] = (df_ranking['autonomias'] / df_ranking['total_aulas'] * 100).round(1)
        df_ranking = df_ranking.sort_values('media_comp', ascending=True)

        fig_rank = px.bar(
            df_ranking, y='estudante_nome', x='media_comp',
            orientation='h',
            color='taxa_autonomia',
            color_continuous_scale='Greens',
            labels={
                'estudante_nome': 'Aluno',
                'media_comp': 'Média Compreensão (1-4)',
                'taxa_autonomia': '% Autonomia'
            }
        )
        fig_rank.update_xaxes(range=[0, 4.5])
        fig_rank.add_vline(x=3, line_dash="dot", line_color="orange", annotation_text="Bom")
        fig_rank.add_vline(x=4, line_dash="dot", line_color="green", annotation_text="Ótimo")
        fig_rank.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            height=max(250, len(df_ranking) * 40),
            margin=dict(l=0, r=0, t=10, b=0)
        )
        st.plotly_chart(fig_rank, use_container_width=True)

    st.write("<br>", unsafe_allow_html=True)

    # ==========================================
    # TABELA RESUMO DETALHADA
    # ==========================================
    st.subheader("📋 Tabela Resumo por Aluno")

    resumo_alunos = []
    aluno_ids = df['estudante_id'].unique()

    for a_id in aluno_ids:
        nome = df[df['estudante_id'] == a_id]['estudante_nome'].iloc[0]
        df_al = df[df['estudante_id'] == a_id]
        df_al_pres = df_al[df_al['compareceu'] == 1]

        total = len(df_al)
        pres = len(df_al_pres)
        taxa_p = (pres / total * 100) if total > 0 else 0

        if not df_al_pres.empty and 'nivel_compreensao' in df_al_pres.columns:
            notas = df_al_pres['nivel_compreensao'].apply(compreensao_para_nota)
            media = notas.mean()
            ultimo_nivel = compreensao_label(df_al_pres.iloc[0].get('nivel_compreensao', 0))
        else:
            media = 0
            ultimo_nivel = "Sem dados"

        # Verificar se tem consolidado com alta
        cons_aluno = [c for c in consolidados_turma if c.get('estudante_id') == a_id]
        tem_alta = any(c.get('recomendacao_alta') for c in cons_aluno)

        resumo_alunos.append({
            "Estudante": nome,
            "Presenças": pres,
            "Faltas": total - pres,
            "Frequência": f"{taxa_p:.0f}%",
            "Média Compreensão": f"{media:.1f}",
            "Último Nível": ultimo_nivel,
            "Alta Sugerida": "✅ Sim" if tem_alta else "—"
        })

    df_resumo = pd.DataFrame(resumo_alunos)
    df_resumo = df_resumo.sort_values("Média Compreensão", ascending=False)
    st.dataframe(df_resumo, use_container_width=True, hide_index=True)

    # Destaques
    if not df_resumo.empty:
        alunos_criticos = df_resumo[df_resumo['Média Compreensão'].astype(float) <= 2.0]
        if not alunos_criticos.empty:
            st.warning(f"⚠️ **{len(alunos_criticos)} aluno(s) com média de compreensão ≤ 2.0** (requerem atenção redobrada):")
            for _, row in alunos_criticos.iterrows():
                st.write(f"  - **{row['Estudante']}** — Média: {row['Média Compreensão']}/4 | Frequência: {row['Frequência']}")

import streamlit as st
import pandas as pd
import datetime
from database.crud import (
    listar_turmas, listar_estudantes,
    listar_registros_por_estudante, listar_consolidados_por_estudante,
    compreensao_para_nota, compreensao_label, compreensao_emoji
)
from utils.styles import page_header
from utils.export_utils import gerar_pdf_dossie_estudante

def render():
    page_header("🧑‍🎓 Dossiê do Estudante", "Prontuário completo, contínuo e analítico do aluno no apoio ao Reforço.")

    turmas = listar_turmas()
    if not turmas:
        st.warning("Nenhuma turma cadastrada no sistema.")
        return

    # 1. Filtros em Cascata
    st.subheader("1. Selecione o(a) Estudante")
    
    c_t, c_e = st.columns(2)
    with c_t:
        turma_opcoes = {f"{t['nome']} ({t['etapa_nome']})": t['id'] for t in turmas}
        turma_sel_nome = st.selectbox("Selecione a Turma:", list(turma_opcoes.keys()))
        turma_id_sel = turma_opcoes[turma_sel_nome]

    with c_e:
        todos_estudantes = listar_estudantes()
        # Filtra os estudantes da turma selecionada
        estudantes_turma = [e for e in todos_estudantes if e.get('turma_id') == turma_id_sel]
        
        if not estudantes_turma:
            st.warning("Nenhum estudante cadastrado nesta turma.")
            return
            
        est_opcoes = {e['nome']: e['id'] for e in estudantes_turma}
        aluno_sel_nome = st.selectbox("Selecione o Estudante:", list(est_opcoes.keys()))
        aluno_id_sel = est_opcoes[aluno_sel_nome]

    st.divider()

    # 2. Resgatar todos os históricos do Firebase
    historico_diario = listar_registros_por_estudante(aluno_id_sel)
    historico_mensal = listar_consolidados_por_estudante(aluno_id_sel)

    if not historico_diario and not historico_mensal:
        st.info("Nenhum registro de participação em reforço escolar localizado para este(a) estudante.")
        return

    # Filtro por Período
    st.subheader("2. Filtrar Período")
    cf1, cf2, cf3 = st.columns(3)
    with cf1:
        bim_filtro = st.selectbox("Bimestre:", ["Todos", "I", "II", "III", "IV"], key="dossie_bim")
    with cf2:
        data_inicio = st.date_input("Data Início (opcional):", value=None, key="dossie_dt_ini")
    with cf3:
        data_fim = st.date_input("Data Fim (opcional):", value=None, key="dossie_dt_fim")

    # Aplicar filtros
    if bim_filtro != "Todos":
        historico_diario = [r for r in historico_diario if r.get('bimestre') == bim_filtro]
        historico_mensal = [c for c in historico_mensal if c.get('bimestre') == bim_filtro]
    if data_inicio:
        historico_diario = [r for r in historico_diario if r.get('data_registro', '') >= data_inicio.isoformat()]
    if data_fim:
        historico_diario = [r for r in historico_diario if r.get('data_registro', '') <= data_fim.isoformat()]

    if not historico_diario and not historico_mensal:
        st.info("Nenhum registro encontrado para o período selecionado.")
        return

    # Botão de Exportação PDF
    aluno_info = next((e for e in estudantes_turma if e['id'] == aluno_id_sel), {})
    etapa_aluno = aluno_info.get('etapa_nome', '')
    try:
        pdf_bytes = gerar_pdf_dossie_estudante(
            nome_aluno=aluno_sel_nome,
            turma_nome=turma_sel_nome.split(' (')[0],
            etapa_nome=etapa_aluno,
            historico_diario=historico_diario,
            historico_mensal=historico_mensal
        )
        nome_arq = f"dossie_{aluno_sel_nome.replace(' ', '_')}_{datetime.date.today().isoformat()}.pdf"
        st.download_button(
            label="📥 Exportar Dossiê em PDF",
            data=pdf_bytes,
            file_name=nome_arq,
            mime="application/pdf",
            use_container_width=True,
            type="secondary"
        )
    except Exception as e:
        st.error(f"Erro ao gerar PDF: {e}")

    # 3. Painel de Métricas (Dashboard Individual)
    st.subheader(f"📊 Panorama: {aluno_sel_nome} {'(Bim ' + bim_filtro + ')' if bim_filtro != 'Todos' else '(Geral)'}")

    df_d = pd.DataFrame(historico_diario)
    
    if not df_d.empty:
        total_lancamentos = len(df_d)
        presentes = len(df_d[df_d['compareceu'] == 1])
        faltas = total_lancamentos - presentes
        
        taxa_presenca = (presentes / total_lancamentos) * 100 if total_lancamentos > 0 else 0
        
        aulas_mat = len(df_d[(df_d['compareceu'] == 1) & (df_d['prof_area'] == 'Matemática')])
        aulas_port = len(df_d[(df_d['compareceu'] == 1) & (df_d['prof_area'] == 'Português')])

        # Calcular nível de Autonomia Pessoal (usando escala unificada)
        df_pres = df_d[df_d['compareceu'] == 1].copy()
        if not df_pres.empty and 'nivel_compreensao' in df_pres.columns:
            df_pres['nota_unificada'] = df_pres['nivel_compreensao'].apply(compreensao_para_nota)
            df_pres['is_autonomo'] = df_pres['nota_unificada'].apply(lambda x: 1 if x == 4 else 0)
            taxa_autonomia = (df_pres['is_autonomo'].sum() / len(df_pres)) * 100
        else:
            taxa_autonomia = 0

        # Renderizando as colunas do Dashboard
        ca, cb, cc, cd = st.columns(4)
        ca.metric("Total Lançamentos (Dias)", total_lancamentos)
        cb.metric("Taxa de Comparecimento", f"{taxa_presenca:.1f}%", help=f"Presenças: {presentes} / Faltas: {faltas}")
        cc.metric("Sessões (Mat/Port)", f"{aulas_mat} / {aulas_port}")
        
        # Colorir a métrica de autonomia baseado no estado
        cd.metric("Autonomia Total do Aluno", f"{taxa_autonomia:.1f}%")
        
        st.write("<br>", unsafe_allow_html=True)
        
    # 4. Conselho de Alta (Listar Fechamentos Mensais em Destaque)
    if historico_mensal:
        st.subheader("📋 Relatórios de Conselho Bimestral (Desfechos)")
        for cons in historico_mensal:
            if cons.get('recomendacao_alta'):
                st.success(f"🎓 **URGENTE: ALTA SUGERIDA (Bim {cons.get('bimestre')})**  \nOs professores de reforço indicam que este aluno atingiu autonomia suficiente!")
            else:
                st.info(f"**Fechamento Bimestral ({cons.get('bimestre')}):** {cons.get('parecer_evolutivo', 'Em processo')}")
            
            if cons.get('acao_pedagogica'):
                st.warning(f"📌 **Ação Pedagógica Sugerida ao Regente:** {cons.get('acao_pedagogica')}")
                
            if cons.get('observacao_geral'):
                st.write(f"*Obs. Privada do Reforço:* {cons.get('observacao_geral')}")
            st.divider()

    # 4.5 Evolução Temporal em Gráfico
    if not df_d.empty:
        df_pres_evol = df_d[df_d['compareceu'] == 1].copy()
        if len(df_pres_evol) > 1 and 'nivel_compreensao' in df_pres_evol.columns:
            st.subheader("📈 Evolução Temporal (Compreensão)")
            df_pres_evol['nota'] = df_pres_evol['nivel_compreensao'].apply(compreensao_para_nota)
            df_pres_evol['data_dt'] = pd.to_datetime(df_pres_evol['data_registro'])
            df_pres_evol = df_pres_evol.sort_values(by='data_dt', ascending=True)
            
            import plotly.express as px
            fig_evol = px.line(df_pres_evol, x='data_registro', y='nota', markers=True, color='prof_area',
                               title="Evolução da Avaliação ao Longo do Tempo",
                               labels={'data_registro': 'Data da Aula', 'nota': 'Nível (1 a 4)', 'prof_area': 'Disciplina'},
                               color_discrete_sequence=px.colors.qualitative.Bold)
            fig_evol.update_yaxes(range=[0.5, 4.5], tickvals=[1, 2, 3, 4], ticktext=["1 - Não comp.", "2 - Muita int.", "3 - Pouca int.", "4 - Autônomo"])
            st.plotly_chart(fig_evol, use_container_width=True)
            st.divider()

    # 5. Timeline Vertical (Logs Diários)
    if not df_d.empty:
        st.subheader("📆 Timeline Contínua (Lançamentos de Reforço)")
        
        for reg in historico_diario:
            data_f = datetime.datetime.strptime(reg['data_registro'], '%Y-%m-%d').strftime('%d/%m/%Y')
            area = reg.get('prof_area', 'Revisão')
            prof_nome = reg.get('prof_nome', 'Equipe')
            
            # Caixa estilizada baseada na presença
            with st.container(border=True):
                if reg['compareceu'] == 1:
                    st.markdown(f"🗓️ **{data_f}** | Bimestre: {reg.get('bimestre')} | **🟢 PRESENTE**")
                    st.markdown(f"**Área:** {area} (`Professor(a): {prof_nome}`)")
                    st.markdown(f"**Habilidade Trabalhada:** {reg.get('habilidade_trabalhada')}")
                    
                    # Compreensão unificada (qualitativa com emoji)
                    nv_raw = reg.get('nivel_compreensao')
                    nv_label = compreensao_label(nv_raw)
                    nv_emoji = compreensao_emoji(nv_raw)
                    st.markdown(f"**Compreensão alcançada:** {nv_emoji} *{nv_label}* | Foco: {reg.get('participacao')}")
                    
                    if reg.get('tipo_atividade'):
                        st.markdown(f"**Tipo de Atividade:** {reg.get('tipo_atividade')}")
                        
                    if reg.get('estado_emocional') and reg.get('estado_emocional') != "Não Observado":
                        st.markdown(f"**Estado Emocional:** {reg.get('estado_emocional')}")
                    
                    if reg.get('dificuldade_latente'):
                        st.markdown(f"**⚠️ Gargalo Latente Mapeado:** <span style='color:red;'>{reg.get('dificuldade_latente')}</span>", unsafe_allow_html=True)
                        
                    if reg.get('observacao'):
                        st.markdown(f"**Observação:** *{reg.get('observacao')}*")
                else:
                    st.markdown(f"🗓️ **{data_f}** | Bimestre: {reg.get('bimestre')} | **🔴 FALTOU**")
                    st.markdown(f"`Professor(a): {prof_nome}`")
                    st.markdown(f"**Motivo Alegado:** {reg.get('motivo_falta')}")
            st.write("<br>", unsafe_allow_html=True)

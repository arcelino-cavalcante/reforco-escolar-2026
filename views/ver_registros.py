import streamlit as st
import datetime
import pandas as pd
from database.crud import listar_todos_registros_mes
from utils.styles import page_header
from utils.export_utils import gerar_excel_auditoria

def render():
    page_header("🔍 Auditoria de Registros", "Filtre e analise todo o fluxo de preenchimento diário do mês.")
    
    hoje = datetime.date.today()
    
    c_mes, c_ano, _ = st.columns([1, 1, 3])
    with c_mes:
        mes_f = st.number_input("Mês da Consulta", 1, 12, hoje.month)
    with c_ano:
        ano_f = st.number_input("Ano da Consulta", 2020, 2030, hoje.year)
        
    dados_brutos = listar_todos_registros_mes(mes_f, ano_f)
    if not dados_brutos:
        st.warning(f"Nenhum registro encontrado no sistema para o mês {mes_f:02d}/{ano_f}.")
        return
        
    df = pd.DataFrame(dados_brutos)
    
    st.write("---")
    st.markdown("##### 🗂️ Filtros de Localização")
    
    c1, c2, c3 = st.columns(3)
    
    # 1. Filtro Etapa
    todas_etapas = ["Todas as Etapas"] + sorted(list(df['etapa_nome'].unique()))
    with c1:
        etapa_sel = st.selectbox("1. Etapa de Ensino:", todas_etapas)
        
    # Aplicar primeiro filtro proximo para afetar as Turmas
    df_filtrado = df if etapa_sel == "Todas as Etapas" else df[df['etapa_nome'] == etapa_sel]
    
    # 2. Filtro Turma
    todas_turmas = ["Todas as Turmas"] + sorted(list(df_filtrado['turma_nome'].unique()))
    with c2:
        turma_sel = st.selectbox("2. Turma Específica:", todas_turmas)
        
    if turma_sel != "Todas as Turmas":
        df_filtrado = df_filtrado[df_filtrado['turma_nome'] == turma_sel]
        
    # 3. Filtro Professor
    todos_profs = ["Todos os Professores de Reforço"] + sorted(list(df_filtrado['prof_nome'].unique()))
    with c3:
        prof_sel = st.selectbox("3. Prof. Lançador:", todos_profs)
        
    if prof_sel != "Todos os Professores de Reforço":
        df_filtrado = df_filtrado[df_filtrado['prof_nome'] == prof_sel]
        
    st.write("<br>", unsafe_allow_html=True)
    st.subheader(f"📋 Resultados Processados ({len(df_filtrado)} lançamentos)")
    
    if len(df_filtrado) == 0:
        st.info("A combinação dos filtros não resultou em nenhum lançamento.")
        return
        
    # Tratamento final de exibicao da DF para visualização clara do usuário (renomeando colunas feias)
    df_exibicao = df_filtrado.copy()
    
    df_exibicao['Status'] = df_exibicao['compareceu'].apply(lambda x: '🟢 Presente' if x == 1 else '🔴 Ausente')
    
    # Coluna híbrida (Se presente joga Habilidade, se ausente joga Motivo)
    def calc_resumo(row):
        if row['compareceu'] == 1:
            texto = f"{row['origem_conteudo']} - {row['habilidade_trabalhada']}"
            if 'tipo_atividade' in row and pd.notna(row['tipo_atividade']):
                texto += f" ({row['tipo_atividade']})"
            return texto
        return f"Motivo Falta: {row['motivo_falta']}"
        
    df_exibicao['Anotação do Dia'] = df_exibicao.apply(calc_resumo, axis=1)
    
    # Limpando a base descartando colunas de IDs internos
    colunas_finais = {
        'data_registro': 'Data',
        'estudante_nome': 'Estudante',
        'etapa_nome': 'Etapa',
        'turma_nome': 'Turma',
        'prof_nome': 'Professor(a) Reforço',
        'prof_regente_nome': 'Professor(a) Regente',
        'Status': 'Status',
        'Anotação do Dia': 'Anotação do Dia'
    }
    
    # Garantir que a coluna existe (registros antigos podem não ter)
    if 'prof_regente_nome' not in df_exibicao.columns:
        df_exibicao['prof_regente_nome'] = ''
    df_exibicao['prof_regente_nome'] = df_exibicao['prof_regente_nome'].fillna('—')
    
    df_clean = df_exibicao[list(colunas_finais.keys())].rename(columns=colunas_finais)
    
    st.dataframe(df_clean, use_container_width=True, hide_index=True)
    
    # Botão de Exportação Excel
    try:
        excel_bytes = gerar_excel_auditoria(df_clean)
        nome_arq = f"auditoria_registros_{mes_f:02d}_{ano_f}.xlsx"
        st.download_button(
            label="📥 Exportar Excel",
            data=excel_bytes,
            file_name=nome_arq,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
            type="secondary"
        )
    except Exception as e:
        st.error(f"Erro ao gerar Excel: {e}")

import streamlit as st
import pandas as pd
import plotly.express as px
from database.crud import listar_todos_registros_diarios, compreensao_para_nota
from utils.styles import page_header

def render():
    page_header("📈 Análise de Evolução", "Analise as respostas dos registros diários de Reforço.")
    
    # Pegar todos os registros de uma vez para fazer as cruzas com pandas
    registros = listar_todos_registros_diarios()
    
    if not registros:
        st.info("Nenhum registro diário encontrado no sistema ainda.")
        return
        
    df = pd.DataFrame(registros)
    
    # Converter a coluna de data para o tipo datetime do pandas
    df['data_registro'] = pd.to_datetime(df['data_registro'])
    df['mes_ano'] = df['data_registro'].dt.strftime('%m/%Y')
    
    # ===== FILTROS ======
    st.subheader("🔍 Filtros de Análise")
    col1, col2, col3 = st.columns(3)
    
    with col1:
        # Extrair as áreas únicas e tratar vazios
        areas = df['prof_area'].dropna().unique().tolist()
        if 'Português' not in areas: areas.append('Português')
        if 'Matemática' not in areas: areas.append('Matemática')
        
        area_sel = st.selectbox("Área do Reforço:", ["Todas"] + sorted(areas))
        
    with col2:
        meses = df['mes_ano'].unique().tolist()
        mes_sel = st.selectbox("Mês de Referência:", ["Todos"] + sorted(meses, reverse=True))
        
    with col3:
        turmas = df['turma_nome'].unique().tolist()
        turma_sel = st.selectbox("Turma:", ["Todas"] + sorted(turmas))
        
    # Aplicar filtros
    mask = pd.Series(True, index=df.index)
    
    if area_sel != "Todas":
        mask = mask & (df['prof_area'] == area_sel)
    if mes_sel != "Todos":
        mask = mask & (df['mes_ano'] == mes_sel)
    if turma_sel != "Todas":
        mask = mask & (df['turma_nome'] == turma_sel)
        
    df_filtrado = df[mask]
    
    if df_filtrado.empty:
        st.warning("Nenhum registro encontrado para os filtros selecionados.")
        return

    st.divider()
    
    # ===== MÉTRICAS GLOBAIS ======
    st.subheader("📊 Visão Geral")
    
    total_registros = len(df_filtrado)
    df_compareceu = df_filtrado[df_filtrado['compareceu'] == 1].copy()
    df_faltou = df_filtrado[df_filtrado['compareceu'] == 0]
    
    def calc_autonomia(val):
        return 1 if compreensao_para_nota(val) == 4 else 0
        
    taxa_presenca = (len(df_compareceu) / total_registros * 100) if total_registros > 0 else 0
    
    if not df_compareceu.empty:
        if 'nivel_compreensao' in df_compareceu.columns:
            df_compareceu['is_autonomo'] = df_compareceu['nivel_compreensao'].apply(calc_autonomia)
            taxa_autonomia = (df_compareceu['is_autonomo'].sum() / len(df_compareceu)) * 100
        else:
            taxa_autonomia = 0
            df_compareceu['is_autonomo'] = 0
    else:
        taxa_autonomia = 0
    
    col_m1, col_m2, col_m3 = st.columns(3)
    col_m1.metric("Total de Lançamentos", total_registros)
    col_m2.metric("Taxa de Presença", f"{taxa_presenca:.1f}%")
    col_m3.metric("Atingiu Autonomia (%)", f"{taxa_autonomia:.1f}%", help="Soma das aulas antigas com Nota >= 8 somadas às novas aulas avaliadas verbalmente com Domínio Total.")
    
    st.write("<br>", unsafe_allow_html=True)
    
    # ===== GRÁFICOS VISUAIS ======
    col_g1, col_g2 = st.columns(2)
    
    with col_g1:
        st.write("##### Participação (dos presentes)")
        if not df_compareceu.empty and 'participacao' in df_compareceu.columns:
            part_counts = df_compareceu['participacao'].value_counts().reset_index()
            part_counts.columns = ['Participação', 'Contagem']
            if not part_counts.empty:
                fig_part = px.pie(part_counts, values='Contagem', names='Participação', hole=0.4, 
                                  color_discrete_sequence=px.colors.sequential.Teal)
                st.plotly_chart(fig_part, use_container_width=True)
            else:
                st.info("Nenhum dado de participação.")
        else:
            st.info("Nenhum aluno compareceu nestes filtros.")
            
    with col_g2:
        st.write("##### Motivos de Falta")
        if not df_faltou.empty and 'motivo_falta' in df_faltou.columns:
            falta_counts = df_faltou['motivo_falta'].value_counts().reset_index()
            falta_counts.columns = ['Motivo', 'Contagem']
            if not falta_counts.empty:
                fig_falta = px.bar(falta_counts, x='Motivo', y='Contagem', 
                                   color='Motivo',
                                   color_discrete_sequence=px.colors.qualitative.Pastel)
                st.plotly_chart(fig_falta, use_container_width=True)
            else:
                st.info("Nenhum dado legível sobre falta.")
        else:
            st.success("Não houveram faltas registradas nestes filtros! 🎉")

    st.write("<br>", unsafe_allow_html=True)
    
    col_g3, col_g4 = st.columns(2)
    with col_g3:
        st.write("##### Tipos de Atividades")
        if not df_compareceu.empty and 'tipo_atividade' in df_compareceu.columns:
            df_tipo = df_compareceu.dropna(subset=['tipo_atividade'])
            if not df_tipo.empty:
                tipo_counts = df_tipo['tipo_atividade'].value_counts().reset_index()
                tipo_counts.columns = ['Atividade', 'Contagem']
                fig_tipo = px.pie(tipo_counts, values='Contagem', names='Atividade', hole=0.4, 
                                  color_discrete_sequence=px.colors.sequential.Purp)
                st.plotly_chart(fig_tipo, use_container_width=True)
            else:
                st.info("Nenhum dado legível de atividade.")
        else:
            st.info("Sem dados de atividade.")
            
    with col_g4:
        st.write("##### Estados Emocionais")
        if not df_compareceu.empty and 'estado_emocional' in df_compareceu.columns:
            df_emoc = df_compareceu[df_compareceu['estado_emocional'] != 'Não Observado'].dropna(subset=['estado_emocional'])
            if not df_emoc.empty:
                emoc_counts = df_emoc['estado_emocional'].value_counts().reset_index()
                emoc_counts.columns = ['Estado', 'Contagem']
                fig_emoc = px.bar(emoc_counts, x='Contagem', y='Estado', orientation='h',
                                   color='Estado',
                                   color_discrete_sequence=px.colors.qualitative.Set3)
                st.plotly_chart(fig_emoc, use_container_width=True)
            else:
                st.info("Nenhuma observação emocional registrada.")
        else:
            st.info("Sem dados emocionais.")

    st.write("<br>", unsafe_allow_html=True)

    # ===== HABILIDADES E COMPREENSÃO GERAL ======
    st.subheader("🎯 Destaques de Habilidades e Conteúdos")
    
    if not df_compareceu.empty and 'habilidade_trabalhada' in df_compareceu.columns:
        # Agrupar habilidades e calcular a media de compreensao delas
        df_hab = df_compareceu.dropna(subset=['habilidade_trabalhada', 'nivel_compreensao'])
        
        if not df_hab.empty:
            hab_stats = df_hab.groupby('habilidade_trabalhada').agg(
                Frequencia=('habilidade_trabalhada', 'count'),
                Taxa_Dominio=('is_autonomo', lambda x: x.mean() * 100)
            ).reset_index()
            
            # Ordenar por frequência
            hab_stats = hab_stats.sort_values(by='Frequencia', ascending=False)
            
            # Gráfico das Top 10 Habilidades Trabalhadas
            top_10 = hab_stats.head(10)
            st.write("##### 10 Habilidades mais Trabalhadas (Frequência vs Autonomia do Aluno)")
            
            fig_hab = px.bar(top_10, x='Frequencia', y='habilidade_trabalhada', orientation='h',
                             color='Taxa_Dominio', color_continuous_scale='Greens',
                             labels={'Frequencia': 'Qtd. Aulas', 'habilidade_trabalhada': 'Habilidade', 'Taxa_Dominio': '% Autonomia Conseguida'})
            fig_hab.update_layout(yaxis={'categoryorder':'total ascending'})
            
            st.plotly_chart(fig_hab, use_container_width=True)
            
            # NOVO: Dificuldades Latentes / Gargalos Mapeados
            if 'dificuldade_latente' in df_compareceu.columns:
                df_dif = df_compareceu.dropna(subset=['dificuldade_latente'])
                df_dif = df_dif[df_dif['dificuldade_latente'].str.strip() != ""]
                if not df_dif.empty:
                    st.write("---")
                    st.write("##### 🚨 Principais Gargalos Mapeados (Dificuldades Latentes)")
                    dif_list = df_dif[['data_registro', 'estudante_nome', 'habilidade_trabalhada', 'dificuldade_latente', 'prof_nome']].tail(15)
                    st.dataframe(dif_list, use_container_width=True)
        else:
            st.info("Nenhuma habilidade cadastrada nos registros validados.")
            
    # Tabela final de dados filtrados
    with st.expander("Tabela Completa de Dados Filtrados"):
        cols_mostrar = ['data_registro', 'estudante_nome', 'turma_nome', 'prof_nome', 'prof_area', 'compareceu', 'habilidade_trabalhada', 'nivel_compreensao', 'participacao']
        if 'tipo_atividade' in df_filtrado.columns: cols_mostrar.append('tipo_atividade')
        if 'estado_emocional' in df_filtrado.columns: cols_mostrar.append('estado_emocional')
        st.dataframe(df_filtrado[cols_mostrar], use_container_width=True)

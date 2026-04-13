import streamlit as st
import json
import datetime
import httpx
from openai import OpenAI
from database.crud import (
    obter_contexto_ia, tool_listar_alunos, tool_listar_registros_mes,
    tool_buscar_historico_aluno, listar_estudantes, listar_todos_registros_diarios_ultimos_dias
)
from utils.styles import page_header


# ==========================================
# GERAÇÃO DO CONTEXTO CSV COMPRIMIDO PARA O CÉREBRO DA IA
# ==========================================
def build_data_context_text() -> str:
    """
    Gera um resumo ultra-comprimido em formato CSV dos dados da escola.
    Usado pelo painel 'Cérebro da IA' para exibir o contexto que a IA lê.
    Janela de dados: últimos 30 dias de registros.
    """
    linhas = []

    # === BLOCO 1: ALUNOS ATIVOS ===
    linhas.append("# ALUNOS")
    linhas.append("nome,turma,etapa")
    try:
        alunos = listar_estudantes()
        for a in alunos:
            nome = str(a.get('nome', '')).replace(',', ';')
            turma = str(a.get('turma_nome', '')).replace(',', ';')
            etapa = str(a.get('etapa_nome', '')).replace(',', ';')
            linhas.append(f"{nome},{turma},{etapa}")
    except Exception as e:
        linhas.append(f"ERRO,{e},")

    linhas.append("")

    # === BLOCO 2: REGISTROS DIÁRIOS (ÚLTIMOS 30 DIAS) ===
    linhas.append("# REGISTROS_ULTIMOS_30_DIAS")
    linhas.append("data,aluno,compareceu,habilidade,compreensao,emocional,dificuldade")
    try:
        registros = listar_todos_registros_diarios_ultimos_dias(dias=30)
        for r in registros:
            data = str(r.get('data_registro', ''))
            aluno = str(r.get('estudante_nome', '')).replace(',', ';')
            compareceu = 'Sim' if r.get('compareceu') == 1 else 'Não'
            habilidade = str(r.get('habilidade_trabalhada', '') or '').replace(',', ';')
            compreensao = str(r.get('nivel_compreensao', '') or '').replace(',', ';')
            emocional = str(r.get('estado_emocional', '') or '').replace(',', ';')
            dificuldade = str(r.get('dificuldade_latente', '') or '').replace(',', ';')
            linhas.append(f"{data},{aluno},{compareceu},{habilidade},{compreensao},{emocional},{dificuldade}")
    except Exception as e:
        linhas.append(f"ERRO,{e},,,,,")

    return "\n".join(linhas)

# ==========================================
# DEFINIÇÃO DAS TOOLS PARA A API OPENAI
# ==========================================
AVAILABLE_TOOLS = {
    "tool_listar_alunos": tool_listar_alunos,
    "tool_listar_registros_mes": tool_listar_registros_mes,
    "tool_buscar_historico_aluno": tool_buscar_historico_aluno
}

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "tool_listar_alunos",
            "description": "Lista todos os alunos matriculados no reforço e suas respectivas turmas. Útil para descobrir se um aluno existe e em qual turma ele está lotado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "turma_nome": {
                        "type": "string",
                        "description": "Nome da turma para filtrar (ex: '3º Ano A'). Passe 'Todas' para listar a escola inteira."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_listar_registros_mes",
            "description": "Retorna uma lista massiva com todos os registros diários (aulas dadas) de um mês específico. Fundamental para encontrar maiores gargalos, relatórios de faltas mais frequentes, habilidades mais exercitadas e estados emocionais relatados.",
            "parameters": {
                "type": "object",
                "properties": {
                    "mes": {"type": "integer", "description": "Mês numérico (ex: 4 para Abril)."},
                    "ano": {"type": "integer", "description": "Ano numérico (ex: 2026)."}
                },
                "required": ["mes", "ano"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_buscar_historico_aluno",
            "description": "Busca TODAS as anotações do diário focadas exclusivamente em um único aluno selecionado. Devolve cronologia de datas, presença, habilidades e percepções do professor (compreensão, emoção).",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome_aluno_parcial": {"type": "string", "description": "Nome, sobrenome, ou fragmento do nome do aluno procurado (ex: 'Maria')."}
                },
                "required": ["nome_aluno_parcial"]
            }
        }
    }
]

def build_system_prompt():
    regras_escola = obter_contexto_ia()
    hoje = datetime.date.today()
    return f"""Você é o Assistente Especialista em Dados do sistema de Reforço Escolar.
Sua missão é atuar como Analista Pedagógico, respondendo às perguntas do corpo docente com extrema clareza e cordialidade.
O dia de hoje é {hoje.strftime('%d/%m/%Y')} (Mês {hoje.month}, Ano {hoje.year}).

REGRAS CRÍTICAS (RAG & ATERRAMENTO):
1. USE AS FERRAMENTAS (TOOLS). Se precisarem saber de alunos antigos, frequências, faltas ou histórico, acione as ferramentas disponíveis em vez de tentar adivinhar.
2. NUNCA ALUCINE DADOS. Se você buscou algo com a ferramenta e ela retornou vazio ou o aluno não existe, responda explicitamente: "Não encontrei dados suficientes no sistema."
3. NUNCA revele termos técnicos (como JSON, arrays, 'usei a ferramenta tool_listar...'). Aja naturalmente como se tivesse buscado nos seus próprios arquivos do sistema interno.

DIRETRIZES DA ESCOLA (Instruções Personalizadas do Time de Gestão):
{regras_escola}
"""

def render():
    page_header("🤖 Assistente IA Especialista", "Pergunte aos dados da escola. A IA cruza históricos automaticamente para lhe dar o panorama exato do que ocorre nos reforços.")

    # 1. Autenticação e Chaves
    api_key_input = ""
    try:
        if "openai" in st.secrets:
            api_key_input = st.secrets["openai"].get("api_key", "")
    except Exception:
        pass  
    
    if not api_key_input:
        api_key_input = st.text_input("Chave OpenAI não configurada. Digite aqui:", type="password")
        if not api_key_input:
            st.info("Configure a chave da API no banco Secrets ou insira acima.")
            return

    try:
        client = OpenAI(
            api_key=api_key_input,
            http_client=httpx.Client(timeout=60.0)
        )
    except Exception as e:
        st.error(f"Erro na configuração da API: {e}")
        return

    # 2. Configurar o estado do Chat
    if "messages" not in st.session_state:
        st.session_state.messages = []

    if st.button("🧹 Limpar Histórico do Chat", type="tertiary"):
        st.session_state.messages = []
        st.rerun()
    st.write("---")

    # Exibir a conversa historica (clean UI)
    for msg in st.session_state.messages:
        if msg["role"] in ["user", "assistant"]: 
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

    # 3. Componentes de Sugestão e Input
    st.write("💡 **Experimente perguntar:**")
    c1, c2, c3 = st.columns(3)
    sug_1 = c1.button("Habilidades com mais gargalos de aprendizagem", use_container_width=True)
    sug_2 = c2.button("Quem são os alunos que mais faltaram este mês?", use_container_width=True)
    sug_3 = c3.button("Destaques que se mostraram autônomos hoje", use_container_width=True)
    
    prompt = st.chat_input("O que você deseja descobrir sobre os dados do reforço?")
    
    if sug_1: prompt = "Considerando o mês atual, liste as habilidades que apresentaram mais dificuldade e gargalos pelos alunos, e separe por disciplina."
    if sug_2: prompt = "Liste detalhadamente quais alunos mais faltaram neste mês e os motivos das faltas deles segundo o diário dos professores."
    if sug_3: prompt = "Analisando este mês, quais alunos alcançaram níveis de compreensão autônomos e focados e poderiam futuramente receber alta?"

    # 4. Fluxo de Agent (Tool Calling)
    if prompt:
        # User UI
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # Build Context Array
        api_messages = [{"role": "system", "content": build_system_prompt()}]
        # Adicionar histórico passado de forma que a IA não re-solicite tudo.
        # Precisaremos garantir que as chamadas de Tool fiquem salvas senao a API acusa erro de contexto
        # Porém, para manter as coisas super simples e sem estourar o st.session_state com lixo tecnico:
        # Faremos todas as interceptacoes de Tools nos "bastidores" dentro do MESMO request do usuario,
        # gerando apenas a resposta final do ASSISTANT, e anexamos isso. Acaba sendo puramente state-less
        # (se ele precisar re-chamar, deixaremos, mas as ferramentas da nossa camada são rapidíssimas de DB).
        
        for m in st.session_state.messages:
            api_messages.append(m)

        with st.chat_message("assistant"):
            with st.spinner("Refletindo e Consultando Banco de Dados..."):
                try:
                    # Primeira ligação à inteligência do modelo. Pode pedir ferramenta.
                    response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=api_messages,
                        tools=TOOLS_SCHEMA,
                        tool_choice="auto",
                        stream=True
                    )
                    
                    # Processar streaming da primeira chamada
                    collected_content = ""
                    tool_calls_data = {}
                    first_response_role = "assistant"
                    
                    message_placeholder = st.empty()
                    
                    for chunk in response:
                        delta = chunk.choices[0].delta
                        
                        # Se tem conteúdo textual, exibir em streaming
                        if delta.content:
                            collected_content += delta.content
                            message_placeholder.markdown(collected_content + "▌")
                        
                        # Se tem tool_calls, acumular
                        if delta.tool_calls:
                            for tc in delta.tool_calls:
                                idx = tc.index
                                if idx not in tool_calls_data:
                                    tool_calls_data[idx] = {"id": "", "name": "", "arguments": ""}
                                if tc.id:
                                    tool_calls_data[idx]["id"] = tc.id
                                if tc.function and tc.function.name:
                                    tool_calls_data[idx]["name"] = tc.function.name
                                if tc.function and tc.function.arguments:
                                    tool_calls_data[idx]["arguments"] += tc.function.arguments
                    
                    # Se houve tool_calls, processar
                    if tool_calls_data:
                        message_placeholder.empty()
                        
                        # Reconstruir a mensagem do assistant com tool_calls para o contexto
                        from openai.types.chat import ChatCompletionMessage, ChatCompletionMessageToolCall
                        from openai.types.chat.chat_completion_message_tool_call import Function
                        
                        reconstructed_tool_calls = []
                        for idx in sorted(tool_calls_data.keys()):
                            tc_data = tool_calls_data[idx]
                            reconstructed_tool_calls.append(
                                ChatCompletionMessageToolCall(
                                    id=tc_data["id"],
                                    type="function",
                                    function=Function(name=tc_data["name"], arguments=tc_data["arguments"])
                                )
                            )
                        
                        assistant_msg = ChatCompletionMessage(
                            role="assistant",
                            content=collected_content or None,
                            tool_calls=reconstructed_tool_calls
                        )
                        api_messages.append(assistant_msg)
                        
                        for tc_data in tool_calls_data.values():
                            function_name = tc_data["name"]
                            function_to_call = AVAILABLE_TOOLS.get(function_name)
                            if function_to_call:
                                try:
                                    function_args = json.loads(tc_data["arguments"])
                                    function_response = function_to_call(**function_args)
                                    api_messages.append({
                                        "tool_call_id": tc_data["id"],
                                        "role": "tool",
                                        "name": function_name,
                                        "content": json.dumps(function_response, ensure_ascii=False)
                                    })
                                except Exception as e:
                                    api_messages.append({
                                        "tool_call_id": tc_data["id"],
                                        "role": "tool",
                                        "name": function_name,
                                        "content": json.dumps({"erro": str(e)})
                                    })
                        
                        # Segunda Chamada de Síntese (com streaming)
                        second_response = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=api_messages,
                            stream=True
                        )
                        
                        full_response = ""
                        for chunk in second_response:
                            if chunk.choices[0].delta.content:
                                full_response += chunk.choices[0].delta.content
                                message_placeholder.markdown(full_response + "▌")
                        message_placeholder.markdown(full_response)
                        
                    else:
                        # Resposta direta com streaming (sem ferramentas)
                        message_placeholder.markdown(collected_content)
                        full_response = collected_content
                        
                except Exception as ex:
                    st.error(f"Ocorreu um erro estrutural na API da IA: {ex}")
                    return
        
        # Salva somento o Output humano no histórico de tela
        st.session_state.messages.append({"role": "assistant", "content": full_response})

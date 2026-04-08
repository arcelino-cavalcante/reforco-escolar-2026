import streamlit as st

def aplicar_estilos():
    """Remove branding do Streamlit e aplica visual de aplicativo nativo."""
    st.markdown("""
        <style>
            #MainMenu {visibility: hidden;}
            footer {visibility: hidden;}
            .stDeployButton {display:none;}
            
            /* Ajuste de Header para Celular: Esconde a barra mas mantém o botão de Menu */
            [data-testid="stHeader"] {
                background-color: rgba(255, 255, 255, 0);
            }
            [data-testid="stHeader"] > div:first-child {
                visibility: hidden;
            }
            [data-testid="stHeader"] [data-testid="stSidebarCollapseButton"] {
                visibility: visible;
                background-color: #f0f2f6;
                border-radius: 50%;
            }

            /* Remove espaço extra no topo */
            .block-container {
                padding-top: 2rem;
                padding-bottom: 2rem;
            }
            
            /* Estilo PWA - Força barra de rolagem limpa */
            ::-webkit-scrollbar {
                width: 8px;
            }
            ::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            ::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 10px;
            }
        </style>
        
        <script>
            // Registro de Manifesto PWA via injeção JS dinâmica
            if (!document.getElementById('pwa-manifest')) {
                var link = document.createElement('link');
                link.id = 'pwa-manifest';
                link.rel = 'manifest';
                link.href = './pwa/manifest.json';
                document.getElementsByTagName('head')[0].appendChild(link);
            }

            // Registro do Service Worker
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                    navigator.serviceWorker.register('./pwa/sw.js').then(function(registration) {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    }, function(err) {
                        console.log('ServiceWorker registration failed: ', err);
                    });
                });
            }
        </script>
    """, unsafe_allow_html=True)

def page_header(titulo, descricao=""):
    """Renderiza o header de uma página usando o padrão Streamlit."""
    st.header(titulo)
    if descricao:
        st.caption(descricao)
    st.divider()

def custom_card(titulo, conteudo, icone="📋"):
    """Renderiza um card simples usando o container nativo do Streamlit."""
    with st.container(border=True):
        st.subheader(f"{icone} {titulo}")
        st.write(conteudo)

def status_badge(status):
    """Retorna texto simples de status."""
    return f"**[{status.upper()}]**"

def prioridade_badge(prioridade):
    """Retorna texto simples de prioridade."""
    return f"**[{prioridade.upper()}]**"

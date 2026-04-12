# 🔗 Amigos-Share Scripts

![GitHub repo size](https://img.shields.io/github/repo-size/bitts/amigos-share)
![GitHub stars](https://img.shields.io/github/stars/bitts/amigos-share?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/bitts/amigos-share)
![License](https://img.shields.io/badge/license-MIT%20%2B%20Apache--2.0-blue)

Coleção de **User Scripts (Tampermonkey/Greasemonkey)** criados para **melhorar a experiência de navegação no Amigos-Share Club**, adicionando automações, melhorias visuais, carregamento automático de páginas, recursos extras de interface e utilidades diversas.

> 📌 Ideal para quem quer **mais produtividade, menos cliques e navegação contínua**.

---

# 📚 Sumário

- [✨ O que é este projeto](#-o-que-é-este-projeto)
- [🚀 Funcionalidades](#-funcionalidades)
- [🧩 Scripts incluídos](#-scripts-incluídos)
- [🛠️ Requisitos](#️-requisitos)
- [🌐 Compatibilidade](#-compatibilidade)
- [📥 Instalação passo a passo (iniciantes)](#-instalação-passo-a-passo-iniciantes)
- [📸 Exemplos visuais (screenshots)](#-exemplos-visuais-screenshots)
- [⚙️ Configurações](#️-configurações)
- [❓ Problemas comuns](#-problemas-comuns)
- [👨‍💻 Contribuindo](#%E2%80%8D-contribuindo)
- [📄 Licença](#-licença)

---

# ✨ O que é este projeto

Este repositório contém **scripts JavaScript do tipo User Script (.user.js)** que rodam diretamente no navegador através de extensões como **Tampermonkey**.

Eles **modificam e melhoram o comportamento do site Amigos-Share**, adicionando:

✅ Scroll infinito  
✅ Carregamento automático  
✅ Melhorias de interface  
✅ Multilínguas  
✅ Debug  
✅ Atualizações automáticas  
✅ Automação de tarefas repetitivas  

Tudo isso **sem instalar programas no computador**, apenas usando o navegador.

---

# 🚀 Funcionalidades

## 📜 Scroll infinito
Carrega automaticamente novas páginas ao rolar a tela.

## 🌍 Suporte multilínguas
Interface adaptável:
- Português
- Inglês
- Espanhol
- Chinês
- Hindi
- Francês

## 🔄 Atualização automática
O script verifica novas versões e avisa quando houver update.

## 🐛 Debug opcional
Modo desenvolvedor para identificar problemas facilmente.

## ⚡ Melhor performance
Menos cliques, menos páginas, navegação contínua.

---

# 🧩 Scripts incluídos

| Script | Função |
|-------|--------|
| `ASL` | Script principal com melhorias gerais |
| `CheckUpdate` | Verifica por autualizações com base no que esta definido em @updateURL |

> 💡 Você pode instalar apenas os que desejar.

---

# 🛠️ Requisitos

Você precisa apenas de:

## 1️⃣ Navegador moderno
- Chrome
- Edge
- Opera
- Brave
- Firefox
- Safari (versões recentes)

## 2️⃣ Extensão de User Scripts (obrigatório)

### 👉 Tampermonkey (RECOMENDADO)
https://www.tampermonkey.net/

Alternativas:
- Violentmonkey
- Greasemonkey

---

# 🌐 Compatibilidade

| Navegador | Status |
|-----------|----------|
| Chrome | ✅ Total |
| Edge | ✅ Total |
| Opera | ✅ Total |
| Brave | ✅ Total |
| Firefox | ⚠️ Parcial |
| Safari | 🟡 Testes limitados |

> Para melhor estabilidade use **Chrome ou Edge + Tampermonkey**

---

# 📥 Instalação passo a passo (iniciantes)

## 🔹 PASSO 1 — Instalar Tampermonkey

Acesse:
👉 https://www.tampermonkey.net/

Instale a extensão no navegador.

---

## 🔹 PASSO 2 — Baixar um script

No GitHub:

1. Abra o arquivo `Amigos-Share-loading.user.js`
2. Clique em **RAW**
3. O Tampermonkey abrirá automaticamente

---

## 🔹 PASSO 3 — Instalar

Clique em:


Pronto ✅

---

## 🔹 PASSO 4 — Usar

Entre no site do Amigos-Share normalmente.

O script será executado automaticamente 🎉

---

# 📸 Exemplos visuais (screenshots)

## Instalar Tampermonkey
![Tampermonkey](https://raw.githubusercontent.com/wiki/OpenUserJS/OpenUserJS.org/images/tampermonkey1.png)

## Abrir arquivo RAW
![RAW](https://github.com/user-attachments/assets/764effcc-8869-4d4d-95d5-450b15fe7820)

## Instalar script
![Install](https://github.com/user-attachments/assets/54d5e5b1-22e8-48cd-a1ea-ff34ec568c8d)

## Script funcionando (scroll infinito)
> Carregamento da terceira para quarta página
![Exemplo de carregamento da terceira para quarta página](https://raw.githubusercontent.com/bitts/amigos-share/refs/heads/v2.1.0/asc_load-ajax2.png)
> Carregamento para o modo Capa
![Exemplo de carregamento para o modo Capa](https://github.com/user-attachments/assets/f4111dc5-12aa-4738-b2c0-009d98808ff0)

## Verificar se o script está ativo

![AtivandoScript](https://mbitts.com/asc/tampermonkey1.png)

![AtivandoScript](https://mbitts.com/asc/chrome1.png)

**Obs**.: Para os usuários da extensão Tampermonkey (versão 5.3+) em um navegador baseado no **Chrome**, é necessário habilitar o "**Permitir Scripts do Usuário**" (disponível no Chrome 138+ nas configurações da extensão) ou o Modo de Desenvolvedor.

![AtivandoExtensao](https://mbitts.com/asc/chrome2.png)

Para mais informações verifique o link: 
https://www.tampermonkey.net/faq.php?q=Q209

# ⚙️ Configurações

Abra o painel do Tampermonkey:

1. Clique no ícone da extensão
2. Dashboard
3. Selecione o script

Você pode:
- ativar/desativar
- editar código
- mudar idioma
- ativar debug
- forçar atualização

---

# ❓ Problemas comuns

## Script não executa
✔ Verifique se está ativado no Tampermonkey

## Página não carrega automático
✔ Limpe cache  
✔ Atualize o script

## Firefox não funciona corretamente
✔ Use Chrome ou Edge

## Erro após atualização do site
✔ Aguarde atualização do script ou reporte issue

---

# 👨‍💻 Contribuindo

Contribuições são bem-vindas!

### Como contribuir:

```bash
git clone https://github.com/bitts/amigos-share
```

- Crie uma branch
- Faça alterações
- Commit
- Pull Request

Ideias:

- novas automações
- melhorias UI
- correções
- traduções
- documentação


---

# 📄 Licença

Distribuído sob:

MIT + Apache-2.0

Você pode:

 ✅ usar
 
 ✅ modificar
 
 ✅ distribuir
 
 ✅ fins comerciais

Desde que mantenha os créditos.


---

# ⭐ Apoie o projeto

Se este projeto te ajudou:

 ⭐ Dê uma estrela no GitHub
 
 🐛 Reporte bugs
 
 💡 Sugira melhorias

---

# ❤️ Autor

Desenvolvido por
https://github.com/bitts

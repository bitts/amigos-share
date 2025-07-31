# [Amigos-Share Club - Comunidade de Torrents](https://cliente.amigos-share.club/)

- [Tampermonkey](https://www.tampermonkey.net/)

- Script: [Amigos-Share-loading.user.js](https://raw.githubusercontent.com/bitts/amigos-share/refs/heads/main/Amigos-Share-loading.user.js)


![Exemplo de carregamento da sexta página](https://github.com/bitts/amigos-share/blob/main/asc_load-ajax.png)

## Uso
https://www.tampermonkey.net/?ext=dhdg


## Recursos
- Scroll infinito para todos as url's da comunidade que contém paginação vísivel através do elemento de classe "pagination";
- Sistema multilinguagem

    Obs.: Setado de acordo com definição da lingua default da página / obtido utilizando ```document.documentElement.lang```

    Disponíveis: Inglês (en), Mandarim (zh-cn), Espanhol (es), Hindi (hi) e Francês (fr).

- Ativação/Desativação das mensagem para debug;
- Verifica por atualizações: Quando o script é atualizado no github, um aviso sugere a atualização do mesmo, ação que pode ser realizado quando clicado no aviso;


Obs.: Não foi testado no Violentmonkey / Somente Tampermonkey (Google Chrome)

O que é Tampermonkey:
É um gerenciador de scripts de usuário popular para navegadores baseados em Blink e WebKit, como Chrome, Edge, Safari, Opera e Firefox. 
Permite que você instale, gerencie e execute scripts de usuário em suas páginas web. 

O que é o Violentmonkey:
É uma extensão de código aberto que oferece suporte a scripts de usuário em navegadores com suporte a WebExtensions.É compatível com a maioria dos scripts de Greasemonkey e Tampermonkey.Possui recursos como atualização automática de scripts, execução ordenada de scripts, suporte a funções GM e sincronização com serviços como Dropbox e OneDrive. 

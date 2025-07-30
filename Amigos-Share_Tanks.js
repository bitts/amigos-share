// ==UserScript==
// @name            Amigos-Share Tanks
// @namespace       http://tampermonkey.net/
// @license      	  MIT
// @version         1.0.1
// @description     Percorrendo torrents baixados e realizando a agradecimento
// @author          Marcelo_Valvassori_Bittencourt
// @copyright       2021, Marcelo Valvassori Bittencourt (https://openuserjs.org/users/marcelo.valvassori)
// @namespace       mbitts.com
// @homepageURL     https://openuserjs.org/users/marcelo.valvassori
// @match           https://cliente.amigos-share.club/account-details.php?id=*&action=baixados
// @grant           none
// @icon            https://cliente.amigos-share.club/favicon.ico
// @supportURL      https://github.com/bitts/
// @contributionURL https://github.com/bitts/amigos.share-bot/ams.user.js
// @updateURL 	    https://github.com/bitts/amigos.share-bot/blob/main/ams.user.js

// ==/UserScript==


var myId = prompt("Informe o seu ID de usuario: ");
var page = 0;
var lms = 'https://cliente.amigos-share.club/';

function retorno(txt){
    console.log(txt);
    if($('.logs').length == 0){
        $('body').append(
            $('<div />').css({
                'z-index': '9999999',
                'display': 'block',
                'position': 'fixed',
                'bottom': '10px',
                'left': '10px',
                'width': '300px',
                'text-align': 'left',
                'overflow-y': 'scroll',
                'height': '300px',
                'font-size': 'xx-small'
            }).addClass('btn btn-info btn-md logs').append($('<ul />'))
        );
    }
    $('.logs ul').append( $('<li />').text(txt) );
}

$('.pagination').find('a').map(function(){
	var lnk = $(this).attr('href');
	var vars = [], hash;
	var hashes = lnk.split('&');
	for(var i = 0; i < hashes.length; i++){
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}
	page = (parseInt(page) > parseInt(vars['page']))?page:vars['page'];
});

var i = parseInt(prompt("Comecar pela página de numero: ", 0));
page = parseInt(prompt("Ir ate a página de numero: ", page));

if(page){
	for(; i <= page; i++){
		retorno('Total de Páginas: '+ page +'| Lendo página: '+ i);
		$.ajax({
			url: lms+'account-details.php',
			data: {'action': 'baixados', 'id': myId, 'page': i},
			type: "get",
			success: function(data){
				//retorno('Varrendo arquivos baixados, procurando arquivos não avaliados.');

				$(data).find('ul.list-group li').map(function(){
          			var file = $(this).find('div.list-group-item-content').find('.tooltips').find('a:first').text();
                    var id = $(this).find('a:last').attr('href').replace('download.php?id=','').replace('&click=1','');
					if(id){
						retorno('Avaliando o arquivo de identificador: '+ id);
						if(id && $.isNumeric(id) ){
							$.ajax({
								url: lms+'thanks.php',
								data : {'id': id },
								type: "get",
								success: function(dataR){
								  if(dataR){
								    var resposta = $(dataR).find('div.container-fluid > div.row').find('div:last').text();
								    retorno('Arquivo avaliado | ID: '+ id +' | file: '+ file +'| Retorno: '+ resposta);
								  }
								},
								error: function(err){
									retorno(err)
								}
							});
						}else retorno('Nao foi possivel identificar ID do arquivo.');
					}
				});
			},
			error: function(err){
				retorno(err)
			}
		});
	}
}

//posição inicial do mapa
var def_center_latitude = -23.551476999689513;
var def_center_longitude = -46.72525364575381;
var def_zoom = 12;

//variaveis para guardar a posição do mapa quando a orientação da tela é alterada
var center_latitude = null;
var center_longitude = null;
var zoom = null;
var map_type = null;

var google_map; // objeto do mapa
var markers = new Array;

var orientationChanged = false; // guarda se a orientação foi alterada para plotar os pontos no mappa novamente.
var updates_counter = 0; // semaforo para controlar atualização de dados(icones e pontos no mapa) impedindo que o mapa seja plotado com dados antigos.

var geolocation_watcher; // watcher que pegar a posição do GPS a cada intervalo de tempo
var currentPositionData; // objeto posição da posição atual
var currentPositionMarker; // marcador que mostra a posição atual do GPS no mapa.
var isWatching = false; // indica se esta lendo a posição do usuario.

//var config_followPos = false; // desnecessário implementar.

//é chamada antes da pagina carregar.
getMetadataOnline();

//phonegap
document.addEventListener("deviceready", onDeviceReady, false);
function onDeviceReady() {
    //$("#orientation").html("Phonegap!");
}

$(document).on('pageshow', '#map_page', function(e, data) {
				
	$('#map_canvas').css('height', getRealContentHeight());
	criarMapa();
	startWatchPosition();
});


$(document).on('pageshow', function(e) {
	if($.mobile.activePage.attr('id') != 'map_page'){
		//center_latitude = null;
		//center_longitude = null;
		//zoom = null;
		//map_type = null;
		backupMap();
		stopWatchPosition();
	}else{
		if(orientationChanged){
			plotMapData(false);
			orientationChanged = false;
		}
	}
});

$(window).on( "orientationchange", function( event ) {
	if($.mobile.activePage.attr('id') == 'map_page'){
		backupMap();
		$.mobile.changePage('#map_page',{allowSamePageTransition : true, changeHash: false, transition: 'fade'});
		orientationChanged = true;
	}
});

function startWatchPosition(){
	console.log('startWatchPosition');
	if(!isWatching){
		if(navigator.geolocation){
			navigator.geolocation.getCurrentPosition(
				function(pos){
					currentPositionData = pos;
			},geolocationError,{maximumAge: 3000, timeout: 5000, enableHighAccuracy: true});
			
			geolocation_watcher = navigator.geolocation.watchPosition(updatePosition,geolocationError,{timeout:60000});
			isWatching = true;
		}else{
			errorMessage('Não foi possível acessar um serviço de localização/GPS.');
		}
	}
}

function stopWatchPosition(){
	console.log('stopWatchPosition');
	isWatching = false;
	navigator.geolocation.clearWatch(geolocation_watcher);
}

function geolocationError(error){
	console.log('geolocationError');
	console.log(error);
	switch(error.code) 
    {
	    case error.PERMISSION_DENIED:
	      errorMessage('Não há permissão de acessar o serviço de Geolocalização.');
	      break;
	    case error.POSITION_UNAVAILABLE:
	      errorMessage('Localização Indisponível.');
	      break;
	    case error.TIMEOUT:
	      errorMessage('Tempo esgotado para pegar localização.');
	      break;
	    case error.UNKNOWN_ERROR:
	      errorMessage('Erro desconhecido ao carregar Geolocalização.');
	      break;
    }
}

function createMarker(pos,firsttime){
	console.log('createMarker '+ firsttime);
	if(pos == null){
		console.log('null pos');
		return;
	}
	var posLatLng = new google.maps.LatLng(pos.coords.latitude,pos.coords.longitude);
	currentPositionMarker = new google.maps.Marker({
			animation: firsttime == true ? google.maps.Animation.DROP : null,
			title: 'Você',
			position: posLatLng,
			icon: {fillColor: '#294aa5', strokeColor: '#00cbff', scale: 10, strokeWeight: 10, fillOpacity: 1, strokeOpacity: 0.5, path: google.maps.SymbolPath.CIRCLE},
			map: google_map,
			zIndex: 1
		});
	if(firsttime){
		google_map.panTo(posLatLng);
		google_map.setZoom(13);
	}
}

function updatePosition(pos){
	console.log('updatePosition : ' + pos.coords.latitude + ' / ' + pos.coords.longitude);
	currentPositionData = pos;
	var posLatLng = new google.maps.LatLng(pos.coords.latitude,pos.coords.longitude);
	currentPositionMarker.setPosition(posLatLng);
}

function backupMap(){
	var c = google_map.getCenter();
	center_latitude = c.lat();
	center_longitude = c.lng();
	zoom = google_map.getZoom();
	//console.log('Center Lat : ' + center_latitude);
	//console.log('Center Lgn : ' + center_longitude);
	//console.log('Zoom : ' + zoom);
	map_type = google_map.getMapTypeId();
}

function startLoadingMessage(text){
	// mostrar mensagem de carregando.
	$.mobile.loading("show",{
		text: text,
		textVisible: true	
	});
}

function stopLoadingMessage(){
	$.mobile.loading("hide");
}

function upUpdates(){
	updates_counter++;
	//console.log('upUpdates: '+ updates_counter);
}

function downUpdates(){
	updates_counter--;
	//console.log('downUpdates: '+ updates_counter);
	if(updates_counter == 0){
		plotMapData(true);
	}
}

function errorMessage(message){
	console.log('errorMessage : ' + message);
	$('#error_message').text(message);
	$('#dialogo').popup('open');
}

function getMetadataOnline(){
	console.log('getMetadataOnline');
	$.ajax({
		type: 'GET',
		dataType : 'json',
		url: 'https://script.google.com/macros/s/AKfycbyFxDH37YzSCmx_QgBT3mQ8QPqKXX91Tj2XMgxCbkfaX6OgfDcJ/exec',
		beforeSend: function(){
			//startLoadingMessage("Verificando versão...");
		},
		error: function(jqxhr,status,error){
			//stopLoadingMessage();
			//errorMessage(status+' : '+error);
		},
		success: function(data,status){
			//stopLoadingMessage();
			//errorMessage(status+' : '+data);
			checkMetadata(data);
		}		
	});
}

function checkMetadata(metadataOnline){
	console.log('checkMetaData');
	//console.log('online : ' + JSON.stringify(metadataOnline));
	var metadata;
	if(localStorage.getItem("Metadata")){
		metadata = JSON.parse(localStorage.getItem("Metadata"));		
	}else{
		metadata = new Object;
		metadata.IconsVersion = 0;
		metadata.MapVersion = 0;
		localStorage.setItem("Metadata",JSON.stringify(metadata));
	}
	//console.log('device : ' + JSON.stringify(metadata));
	
	var actualMetada = metadataOnline;
	upUpdates();
	if(metadata.IconsVersion != actualMetada.IconsVersion || !localStorage.getItem("Icones")){
		loadIconsData();
		metadata.IconsVersion = actualMetada.IconsVersion;
		localStorage.setItem("Metadata",JSON.stringify(metadata));
		console.log('icons updated');
		//console.log('new : ' + JSON.stringify(metadata));
		upUpdates();
	}
	if(metadata.MapVersion != actualMetada.MapVersion || !localStorage.getItem("PontosMapa")){
		loadMapData();
		metadata.MapVersion = actualMetada.MapVersion;
		localStorage.setItem("Metadata",JSON.stringify(metadata));
		console.log('map updated');
		//console.log('new : ' + JSON.stringify(metadata));
		upUpdates();
	}
	downUpdates();
}

function loadIconsData(){
	console.log('loadIconsData');
	var url = 'https://script.google.com/macros/s/AKfycbxvbOD2urgp865hZFZbjcCYCfMvWLNcSBkcoGgYzupGo1hlsw8/exec?get=icones'; // parametro final comoo icones
	$.ajax({
		type: 'GET',
		dataType : 'json',
		url: url,
		beforeSend: function(){
			startLoadingMessage("Atualizando icones...");
		},
		error: function(jqxhr,status,error){
			stopLoadingMessage();
			errorMessage(status+' : '+error);
		},
		success: function(data,status){
			stopLoadingMessage();
			callbackLoadIconsData(data);
		}		
	});	
}

function callbackLoadIconsData(data){
	console.log('callbackLoadIconsData');
	var icones = new Array;	
	for(var i=0;i<data.length;i++){
		icones[data[i][0]] = data[i][1];
	}
	//console.log(icones);
	localStorage.setItem("Icones",JSON.stringify(icones));
	downUpdates();
}

function loadMapData(){
	console.log('loadMapData');
	var url = 'https://script.google.com/macros/s/AKfycbxvbOD2urgp865hZFZbjcCYCfMvWLNcSBkcoGgYzupGo1hlsw8/exec?get=pontos'; // parametro final comoo pontos
	$.ajax({
		type: 'GET',
		dataType : 'json',
		url: url,
		beforeSend: function(){
			startLoadingMessage("Atualizando dados...");
		},
		error: function(jqxhr,status,error){
			stopLoadingMessage();
			errorMessage(status+' : '+error);
		},
		success: function(data,status){
			stopLoadingMessage();
			callbackLoadMapData(data);
		}		
	});	
}

function callbackLoadMapData(data){
	console.log('callbackLoadMapData');
	var mapa = new Array;	
	for(var i=0;i<data.length;i++){
		mapa[data[i][0]] = data[i].slice(1);
	}
	//console.log(mapa);
	localStorage.setItem("PontosMapa",JSON.stringify(mapa));
	downUpdates();
}

function plotMapData(firsttime){
	console.log('plotMapData');
	startLoadingMessage('Carregando mapa...');
	createMarker(currentPositionData,firsttime); // posição atual
	var pontos = JSON.parse(localStorage.getItem("PontosMapa"));
	var icones = JSON.parse(localStorage.getItem("Icones"));
	//console.log(pontos);
	//console.log(icones);
	
	//var infowindow = new google.maps.InfoWindow();
	var infoBubble = new InfoBubble({borderRadius: 0,maxWidth:350,minWidth:300,maxHeight:500,borderColor:'#1a8989', backgroundColor:'#3caaaa'});
	for(var i=0;i<pontos.length;i++){
		var icone = icones[pontos[i][0]];
		markers[i] = new google.maps.Marker({
			title: pontos[i][1],
			position: new google.maps.LatLng(parseFloat(pontos[i][3]),parseFloat(pontos[i][4])),
			icon: {url: icone, scaledSize: new google.maps.Size(46,54)},
			map: google_map
		});
		console.log(markers[i]);
		
		//var contentInfo = '<link rel="stylesheet" href="css/themes/LupahTheme.min.css" /><link rel="stylesheet" href="css/jquery.mobile.structure-1.3.2.min.css" />' +
    	//					'<div><h2>'+ pontos[i][1] + '</h2><p>' + pontos[i][13] + '</p><button>Tesste</button></div>';
    	
    	var url_rota = 'http://maps.google.com/maps?saddr='+ currentPositionData.coords.latitude +','+ currentPositionData.coords.longitude +'&daddr='+ pontos[i][3]+','+ pontos[i][4];
    	
    	var contentInfo = '<h2 id="titulo" style="color:#fff">'+ pontos[i][1] + '</h2><p style="color:#fff">Tipo: ' + pontos[i][2] + '<br><br>' + pontos[i][13] + '</p>'+
    	'<div style="margin: 0 auto; text-align: center;"><a href="https://maps.google.com.br/?z=12&layer=c&cbll='+ pontos[i][3]+','+ pontos[i][4] + '&cbp=0" target="_blank"><img src="http://maps.googleapis.com/maps/api/streetview?size=300x100&location='+ pontos[i][3]+','+ pontos[i][4] + '&sensor=false&key=AIzaSyC005bo2oNiOfRJL9otrVZS2jL4Ola2p5o" /></a></div>' +
    	'<fieldset class="ui-grid-b">' +
    	'<div class="ui-block-a"><a href="'+url_rota+'" style="text-decoration: none;" target="_blank"><div class="infobutton"><img src="imgs/rota.png" width="30px" height="30px"/><br>Rota</div></a></div>' +
        '<div class="ui-block-b"><a href="'+pontos[i][15]+'" style="text-decoration: none;'+ (pontos[i][15] != '' ? '' : ' cursor: default;') +'" target="_blank"><div class="infobutton'+ (pontos[i][15] != '' ? '' : '-disabled') +'"><img src="imgs/site.png" width="30px" height="30px"/><br>Site</div></a></div>' +
        '<div class="ui-block-c"><a href="tel:'+pontos[i][12]+'" style="text-decoration: none;'+ (pontos[i][12] != '' ? '' : ' cursor: default;') +'" target="_blank"><div class="infobutton'+ (pontos[i][12] != '' ? '' : '-disabled') +'"><img src="imgs/telefone.png" width="30px" height="30px"/><br>'+ (pontos[i][12] != '' ? pontos[i][12] : 'Telefone') +'</div></a></div>' + 
        '</fieldset>';        
    						
		google.maps.event.addListener(markers[i],'click',(function (marker,content){
			return function(){
				//infowindow.setContent(content);
				//infowindow.open(google_map,marker);
				
				infoBubble.setContent(content);
				infoBubble.open(google_map,marker);
			};
		})(markers[i],contentInfo));
			//markers[i].infowindow.open(google_map,markers[i].marker);
	}
	stopLoadingMessage();
	console.log('end of plotMapData, '+ pontos.length + ' points.');
}


function criarMapa(){
	console.log('criarMapa');

	google_map = new google.maps.Map(document.getElementById('map_canvas'), {
		zoom : zoom != null ? zoom : def_zoom,
		center : new google.maps.LatLng(center_latitude != null ? center_latitude : def_center_latitude , center_longitude != null ? center_longitude : def_center_longitude),
		mapTypeId : map_type != null ? map_type : google.maps.MapTypeId.ROADMAP
	});
}

function getRealContentHeight() {
	var header = $.mobile.activePage.find("div[data-role='header']:visible");
	var footer = $.mobile.activePage.find("div[data-role='footer']:visible");
	var content = $.mobile.activePage.find("div[data-role='content']:visible");
	
	var viewport_height;
	var cheight;
	var coheight;
	
		viewport_height = $(window).height();
		cheight = content.height();
		coheight = content.outerHeight();	

	var content_height = viewport_height - header.outerHeight() - footer.outerHeight();
	if ((coheight - header.outerHeight() - footer.outerHeight()) <= viewport_height) {
		content_height -= (coheight - cheight);
	}
	return content_height;
}
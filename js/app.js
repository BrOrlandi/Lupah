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

var pontosMapa; // variavel para guardar os pontos do mapa. (lidos do localStorage)
var iconesMapa; // guardar os icones dos pontos. (lidos do localStorage) 

var orientationChanged = false; // guarda se a orientação foi alterada para plotar os pontos no mappa novamente.
var updates_counter = 0; // semaforo para controlar atualização de dados(icones e pontos no mapa) impedindo que o mapa seja plotado com dados antigos.

var geolocation_watcher; // watcher que pegar a posição do GPS a cada intervalo de tempo
var currentPositionData; // objeto posição da posição atual
var currentPositionMarker; // marcador que mostra a posição atual do GPS no mapa.
var startPositionMarker;
var startPositionLat;
var startPositionLng; 
var isWatching = false; // indica se esta lendo a posição do usuario.

var infoBubble;

var popupAddressOpen = false;
var searchListFilled = false;

//var config_followPos = false; // desnecessário implementar.

//é chamada antes da pagina carregar.
getMetadataOnline();

//phonegap
// document.addEventListener("deviceready", onDeviceReady, false);
// function onDeviceReady() {
    // //$("#orientation").html("Phonegap!");
// }

$(document).on('pageshow', '#map_page', function(e, data) {
				
	var h = getRealContentHeight();
	$('#map_canvas').css('height', h);
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
		if(popupAddressOpen){
			$('#popupAddress').popup( "close");	
		}
		orientationChanged = true;
		$.mobile.changePage('#map_page',{allowSamePageTransition : true, changeHash: false, transition: 'fade'});
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
			title: 'Você',
			position: posLatLng,
			//icon: {fillColor: '#294aa5', strokeColor: '#00cbff', scale: 10, strokeWeight: 10, fillOpacity: 1, strokeOpacity: 0.5, path: google.maps.SymbolPath.CIRCLE},
			icon: {url: './imgs/icon_localatual2.png', anchor: {x:18,y:18}},
			map: google_map,
			zIndex: 2
		});
	if(firsttime){
		google_map.panTo(posLatLng);
		google_map.setZoom(13);
	}
}

function createStartMarker(firsttime){
	if(firsttime){
		if(currentPositionData != null){
			startPositionLat = currentPositionData.coords.latitude;
			startPositionLng = currentPositionData.coords.longitude;
		}else
		{
			startPositionLat = def_center_latitude;
			startPositionLng = def_center_longitude;
		}
	}
	startPositionMarker = new google.maps.Marker({
			animation: firsttime == true ? google.maps.Animation.DROP : null,
			title: 'Ponto de Partida',
			position: new google.maps.LatLng(startPositionLat,startPositionLng),
			icon: {url: './imgs/icon_partida2.png', anchor: {x:28,y:67}, scaledSize: new google.maps.Size(57,67)},//, scaledSize: new google.maps.Size(50,50)
			draggable: true,
			map: google_map,
			zIndex: 3
		});
	google.maps.event.addListener(startPositionMarker,'click',function(){showAddressBar();});
	google.maps.event.addListener(startPositionMarker,'dragstart',function(){showAddressBar();});
	google.maps.event.addListener(startPositionMarker,'dragend',function(){
		var pos = startPositionMarker.getPosition();
		var slat = pos.lat();
		var slng = pos.lng();
		$.ajax({
		type: 'GET',
		dataType : 'json',
		url: 'http://maps.googleapis.com/maps/api/geocode/json?latlng='+ slat +','+ slng +'&sensor=true',
		beforeSend: function(){
			
		},
		error: function(jqxhr,status,error){

		},
		success: function(data,status){
			$('#addressInput').val(data.results[0].formatted_address);
		}		
	});
	});
}

function showAddressBar(){
	popupAddressOpen = true;
	$('#popupAddress').popup({
	    beforeposition: function () {
	        $('.ui-popup-screen').remove();
	    }
	});
	$('#addressInput').focus();
	//$('#popupAddress').popup({ positionTo: "#headerBar"});
	$('#popupAddress').popup({ positionTo: "#dialogo"});
	$('#popupAddress').width($(window).width()*0.9);
	$('#popupAddress').popup( "open");
	
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
	var pos = startPositionMarker.getPosition();
	startPositionLat = pos.lat();
	startPositionLng = pos.lng();
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
	//console.log('Criou o marcador da posição atual');
	createStartMarker(firsttime);
	//console.log('Criou o marcador de partida');
	pontosMapa = JSON.parse(localStorage.getItem("PontosMapa"));
	iconesMapa = JSON.parse(localStorage.getItem("Icones"));
	//console.log(pontos);
	//console.log(icones);
	
	//var infowindow = new google.maps.InfoWindow();
	
	$('#searchList').html(''); // lista de pesquisar
	
	infoBubble = new InfoBubble({borderRadius: 0,maxWidth:350,minWidth:300,maxHeight:500,borderColor:'#1a8989', backgroundColor:'#3caaaa'});
	for(var i=0;i<pontosMapa.length;i++){
		var icone = iconesMapa[pontosMapa[i][0]];
		markers[i] = new google.maps.Marker({
			title: pontosMapa[i][1],
			position: new google.maps.LatLng(parseFloat(pontosMapa[i][3]),parseFloat(pontosMapa[i][4])),
			icon: {url: icone},
			map: google_map
		});
		//console.log(markers[i]);
	
    	var contentInfo = infoWindowContent(pontosMapa,i); 	   
		google.maps.event.addListener(markers[i],'click',(function (marker,content){
			return function(){
				//infowindow.setContent(content);
				//infowindow.open(google_map,marker);
				
				infoBubble.setContent(content);
				infoBubble.open(google_map,marker);
			};
		})(markers[i],contentInfo));
			//markers[i].infowindow.open(google_map,markers[i].marker);
			
		// adiciona na lista:
		$('#searchList').append('<li onclick="resultSelection_onClick('+i+')"><a href="#">'+ pontosMapa[i][1] +'</a></li>');
		//console.log('Adicionou o ponto '+ pontosMapa[i][1] + ' na lista');
	}
	$('#searchList').listview('refresh'); // atualiza a lista depois de inserir dados.
	//console.log('Atualiza dados da lista.');
	$('input[data-type="search"]').val('');
	$('input[data-type="search"]').trigger("keyup");
	//console.log('Limpa busca');
	stopLoadingMessage();
	console.log('end of plotMapData, '+ pontosMapa.length + ' points.');
}

function infoWindowContent(pontos,i){
	//console.log('infoWindowContent!');
		//var contentInfo = '<link rel="stylesheet" href="css/themes/LupahTheme.min.css" /><link rel="stylesheet" href="css/jquery.mobile.structure-1.3.2.min.css" />' +
    	//					'<div><h2>'+ pontos[i][1] + '</h2><p>' + pontos[i][13] + '</p><button>Tesste</button></div>';
    	
	//var url_rota = 'http://maps.google.com/maps?saddr='+ currentPositionData.coords.latitude +','+ currentPositionData.coords.longitude +'&daddr='+ pontos[i][3]+','+ pontos[i][4];
	//var url_rota = 'http://maps.google.com/maps?saddr='+ lat +','+ lng +'&daddr='+ pontos[i][3]+','+ pontos[i][4];
	
	var contentInfo = '<h2 id="titulo" style="color:#fff">'+ pontos[i][1] + '</h2><p style="color:#fff">' + pontos[i][2] + '<br><br>' + pontos[i][13] + '</p>'+
	//'<div style="margin: 0 auto; text-align: center; cursor: pointer;"><a href="https://maps.google.com.br/?z=12&layer=c&cbll='+ pontos[i][3]+','+ pontos[i][4] + '&cbp=0" target="_blank"><img src="http://maps.googleapis.com/maps/api/streetview?size=300x100&location='+ pontos[i][3]+','+ pontos[i][4] + '&sensor=false&key=AIzaSyC005bo2oNiOfRJL9otrVZS2jL4Ola2p5o" /></a></div>' +
	'<div style="margin: 0 auto; text-align: center; cursor: pointer;" onclick="streetViewClick('+pontos[i][3]+','+ pontos[i][4] +');"><img src="http://maps.googleapis.com/maps/api/streetview?size=300x100&location='+ pontos[i][3]+','+ pontos[i][4] + '&sensor=false&key=AIzaSyC005bo2oNiOfRJL9otrVZS2jL4Ola2p5o" /></div>' +
	'<fieldset class="ui-grid-b">' +
	//'<div class="ui-block-a"><a href="'+url_rota+'" style="text-decoration: none;" target="_blank"><div class="infobutton"><img src="imgs/icon_rota.png" width="30px" height="30px"/><br>Rota</div></a></div>' +
    '<div class="ui-block-a"><div class="infobutton rota-button" onclick="rotaClick('+ pontos[i][3] +','+ pontos[i][4] +');"><img src="imgs/icon_rota.png" width="30px" height="30px"/><br>ROTA</div></div>' +
    '<div class="ui-block-b">'+ (pontos[i][15] != '' ? ('<a href="'+pontos[i][15]+'" style="text-decoration: none;" target="_blank">') : '') +'<div class="infobutton'+ (pontos[i][15] != '' ? '' : '-disabled') +'"><img src="imgs/icon_web.png" width="30px" height="30px"/><br>SITE</div>'+ (pontos[i][15] != '' ? ('</a>') : '')+'</div>' +
    '<div class="ui-block-c">'+ (pontos[i][12] != '' ? ('<a href="tel:'+pontos[i][12]+'" style="text-decoration: none;" target="_blank">') : '') +'<div class="infobutton'+ (pontos[i][12] != '' ? '' : '-disabled') +'"><img src="imgs/icon_call.png" width="30px" height="30px"/><br>'+ (pontos[i][12] != '' ? pontos[i][12] : 'TELEFONE') +'</div>'+ (pontos[i][12] != '' ? ('</a>') : '')+'</div>' + 
    '</fieldset><div class="fb-comments" data-href="http://www.lupah.org/?id='+ i +'" data-width="300"></div>';
	return contentInfo;
};

function rotaClick(lat,lng){
	var pos = startPositionMarker.getPosition();
	var slat = pos.lat();
	var slng = pos.lng();
	//console.log(lat+','+lng);
	var win=window.open('http://maps.google.com/maps?saddr='+ slat +','+ slng +'&daddr='+ lat+','+ lng, '_blank');
  	//win.focus();
}


function streetViewClick(lat,lng){
	var st = google_map.getStreetView();
	st.setPosition(new google.maps.LatLng(lat,lng));
	st.setVisible(true);
}

function criarMapa(){
	console.log('criarMapa');

	google_map = new google.maps.Map(document.getElementById('map_canvas'), {
		zoom : zoom != null ? zoom : def_zoom,
		center : new google.maps.LatLng(center_latitude != null ? center_latitude : def_center_latitude , center_longitude != null ? center_longitude : def_center_longitude),
		mapTypeId : map_type != null ? map_type : google.maps.MapTypeId.ROADMAP
	});
	var input = document.getElementById('addressInput');
	var autocomplete = new google.maps.places.Autocomplete(input);
	 autocomplete.bindTo('bounds', google_map);
	 autocomplete.setTypes(['geocode']);
	//$('#popupAddress-popup').css('z-index','999');
	//$('.pac-container').css('z-index','2000');

  google.maps.event.addListener(autocomplete, 'place_changed', function() {
    var place = autocomplete.getPlace();
    if (!place.geometry) {
      // Inform the user that the place was not found and return.
      return;
    }

    // If the place has a geometry, then present it on a map.
    if (place.geometry.viewport) {
      google_map.fitBounds(place.geometry.viewport);
    } else {
      google_map.setCenter(place.geometry.location);
      google_map.setZoom(15);  // Why 17? Because it looks good.
    }
    startPositionMarker.setPosition(place.geometry.location);

    var address = '';
    if (place.address_components) {
      address = [
        (place.address_components[0] && place.address_components[0].short_name || ''),
        (place.address_components[1] && place.address_components[1].short_name || ''),
        (place.address_components[2] && place.address_components[2].short_name || '')
      ].join(' ');
    }
  });
  
	 
	google.maps.event.addListener(google_map,'click',function(){
		$('input[data-type="search"]').val('');
		$('input[data-type="search"]').trigger("keyup");
		$('#popupAddress').popup("close");
		$('#popupSearch').popup("close");
		$('#popupFilter').popup("close");
		popupAddressOpen = false;
		//infoBubble.close();
	});
	google.maps.event.addListener(google_map,'dragstart',function(){
		$('input[data-type="search"]').val('');
		$('input[data-type="search"]').trigger("keyup");
		$('#popupAddress').popup("close");
		$('#popupSearch').popup("close");
		$('#popupFilter').popup("close");
		popupAddressOpen = false;
	});
}
var pacInit = false;
function pacTest(){
	if(!pacInit){
		pacInit = true;
		$('.pac-container').css('z-index','1666');
	}
}

function getRealContentHeight() {
	//var header = $.mobile.activePage.find("div[data-role='header']:visible");
	var footer = $.mobile.activePage.find("div[data-role='footer']:visible");
	var content = $.mobile.activePage.find("div[data-role='content']:visible");
	
	var viewport_height;
	var cheight;
	var coheight;
	
		viewport_height = $(window).height();
		cheight = content.height();
		coheight = content.outerHeight();	

	//var content_height = viewport_height - header.outerHeight() - footer.outerHeight();
	//if ((coheight - header.outerHeight() - footer.outerHeight()) <= viewport_height) {
	var content_height = viewport_height - footer.outerHeight();
	if ((coheight - footer.outerHeight()) <= viewport_height) {
		content_height -= (coheight - cheight);
	}
	return content_height;
}

function centerPosButton(){
	var posLatLng = new google.maps.LatLng(currentPositionData.coords.latitude,currentPositionData.coords.longitude);
	google_map.panTo(posLatLng);
	google_map.setZoom(15);
	$('#atualButton').removeClass('ui-btn-active');
}
function centerStartButton(){
	google_map.panTo(startPositionMarker.getPosition());
	google_map.setZoom(15);
	$('#partidaButton').removeClass('ui-btn-active');
}

function resultSelection_onClick(index){

    $("#popupSearch").popup('close');

    google_map.panTo(new google.maps.LatLng(pontosMapa[index][3] , pontosMapa[index][4]));
	google_map.setZoom(13);
	
	var contentInfo = infoWindowContent(pontosMapa,index); 	 

	infoBubble.setContent(contentInfo);
	infoBubble.open(google_map, markers[index]);
    
}

function boxclick(box) {
	if (box.checked) {
	  show();
	} else {
	  hide();
	}
}
 
function show() {
	   var elementos = document.getElementsByName('checkbox');
	   var index;
	   var pontos = JSON.parse(localStorage.getItem("PontosMapa"));
       for (var i = 0; i < pontos.length; i++) {
         for(var j = 0; j < elementos.length; j++){
           if(elementos[j].checked && (index = pontos[i][2].toUpperCase().indexOf(elementos[j].getAttribute('class').toUpperCase())) != -1) {
             console.log('i: ' + i + 'setVisible: ' + pontos[i][1] + ' index: ' + index);
             markers[i].setVisible(true);
         }else if(!elementos[j].checked  && (index = pontos[i][2].toUpperCase().indexOf(elementos[j].getAttribute('class').toUpperCase())) != -1){
         	console.log('i: ' + i + 'setInvisible: ' + pontos[i][1] + ' index: ' + index);
            markers[i].setVisible(false);
         }
       }
      }
}
function hide() {
	   var elementos = document.getElementsByName('checkbox');
	   var pontos = JSON.parse(localStorage.getItem("PontosMapa"));
       
       if(checkedCount(elementos)!=0){
        for (var i = 0; i < pontos.length; i++) {
          for(var j = 0; j < elementos.length; j++){
            if(!elementos[j].checked && pontos[i][2].toUpperCase().indexOf(elementos[j].getAttribute('class').toUpperCase()) != -1) {
              console.log('setVisible');
              markers[i].setVisible(false);
          }
         }
       }
      }else{
      	for(var i = 0; i < pontos.length; i++){
      		markers[i].setVisible(true);
      	}
      }
}

function checkedCount(elements){
	var count = 0;
	for(var i = 0; i < elements.length; i++){
		if(elements[i].checked){
		   count++;	
		}
	}
	return count;
}

var searchOpen = false;

function searchPopupOpen(){
	$('#popupSearch').popup({
		afteropen: function(){
			searchOpen = true;
		},
		afterclose: function(){
			searchOpen = false;			
		}
	});
	searchPopupSize();
}

function searchPopupSize(){
	var h = getRealContentHeight();
	var pad = parseInt($('#popupSearch').css('padding-top'));
	pad += parseInt($('#popupSearch').css('padding-bottom'));
	var total = h - pad;
	$('#searchList').css('max-height', total);
	//console.log('Altura h : ' +h);
	//console.log('Padding popup: ' +pad);
	//console.log('Search list height: '+total);
}

function filterPopupOpen(){
	$('#popupFilter').popup({
		beforeposition: function () {
	        $('.ui-popup-screen').remove();
	    }
	});
	var h = getRealContentHeight();
	var pad = parseInt($('#popupFilter').css('padding-top'));
	pad += parseInt($('#popupFilter').css('padding-bottom'));
	var total = h - pad;
	$('#filterList').css('max-height', total);
	console.log('Altura h : ' +h);
	console.log('Padding popup: ' +pad);
	//console.log('Filter list height: '+total);
}

$(window).resize(function(e){
	if(searchOpen){
		searchPopupSize();
	}
});

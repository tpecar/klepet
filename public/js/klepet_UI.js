function divElementEnostavniTekst(sporocilo) {
  var jeSmesko = sporocilo.indexOf('http://sandbox.lavbic.net/teaching/OIS/gradivo/') > -1;
  
  /* preverimo ali gre za video */
  var jeVideo = (new RegExp("https:\\/\\/www\\.youtube\\.com\\/watch\\?v=(\\w*)",'gi')).test(sporocilo);
  
  if (jeSmesko || jeVideo) {
    sporocilo = sporocilo.replace(/\</g, '&lt;').replace(/\>/g, '&gt;').
    /* za nove vrstice */
    replace(new RegExp("&lt;br \/&gt;","gi"),"<br />").
    /* video */
    replace(new RegExp("&lt;(iframe[^;]*)&gt;&lt;(\\/iframe)&gt;","gi"),"<$1> <$2>").
    /* smeski */
    replace('&lt;img', '<img').
    replace('png\' /&gt;', 'png\' />');
    
    return $('<div style="font-weight: bold"></div>').html(sporocilo);
  } else {
    return $('<div style="font-weight: bold;"></div>').text(sporocilo);
  }
}

function divElementHtmlTekst(sporocilo) {
  return $('<div></div>').html('<i>' + sporocilo + '</i>');
}

function procesirajVnosUporabnika(klepetApp, socket) {
  var sporocilo = $('#poslji-sporocilo').val();
  
  sporocilo = dodajVideo(sporocilo);
  sporocilo = dodajSmeske(sporocilo);
  var sistemskoSporocilo;

  if (sporocilo.charAt(0) == '/') {
    sistemskoSporocilo = klepetApp.procesirajUkaz(sporocilo);
    if (sistemskoSporocilo) {
      $('#sporocila').append(divElementHtmlTekst(sistemskoSporocilo));
    }
  } else {
    sporocilo = filtirirajVulgarneBesede(sporocilo);
    klepetApp.posljiSporocilo(trenutniKanal, sporocilo);
    $('#sporocila').append(divElementEnostavniTekst(sporocilo));
    $('#sporocila').scrollTop($('#sporocila').prop('scrollHeight'));
  }

  $('#poslji-sporocilo').val('');
}

var socket = io.connect();
var trenutniVzdevek = "", trenutniKanal = "";

var vulgarneBesede = [];
$.get('/swearWords.txt', function(podatki) {
  vulgarneBesede = podatki.split('\r\n');
});

function filtirirajVulgarneBesede(vhod) {
  for (var i in vulgarneBesede) {
    vhod = vhod.replace(new RegExp('\\b' + vulgarneBesede[i] + '\\b', 'gi'), function() {
      var zamenjava = "";
      for (var j=0; j < vulgarneBesede[i].length; j++)
        zamenjava = zamenjava + "*";
      return zamenjava;
    });
  }
  return vhod;
}

$(document).ready(function() {
  var klepetApp = new Klepet(socket);

  socket.on('vzdevekSpremembaOdgovor', function(rezultat) {
    var sporocilo;
    if (rezultat.uspesno) {
      trenutniVzdevek = rezultat.vzdevek;
      $('#kanal').text(trenutniVzdevek + " @ " + trenutniKanal);
      sporocilo = 'Prijavljen si kot ' + rezultat.vzdevek + '.';
    } else {
      sporocilo = rezultat.sporocilo;
    }
    $('#sporocila').append(divElementHtmlTekst(sporocilo));
  });

  socket.on('pridruzitevOdgovor', function(rezultat) {
    trenutniKanal = rezultat.kanal;
    $('#kanal').text(trenutniVzdevek + " @ " + trenutniKanal);
    $('#sporocila').append(divElementHtmlTekst('Sprememba kanala.'));
  });

  socket.on('sporocilo', function (sporocilo) {
    var novElement = divElementEnostavniTekst(sporocilo.besedilo);
    $('#sporocila').append(novElement);
  });
  
  socket.on('kanali', function(kanali) {
    $('#seznam-kanalov').empty();

    for(var kanal in kanali) {
      kanal = kanal.substring(1, kanal.length);
      if (kanal != '') {
        $('#seznam-kanalov').append(divElementEnostavniTekst(kanal));
      }
    }

    $('#seznam-kanalov div').click(function() {
      klepetApp.procesirajUkaz('/pridruzitev ' + $(this).text());
      $('#poslji-sporocilo').focus();
    });
  });

  socket.on('uporabniki', function(uporabniki) {
    $('#seznam-uporabnikov').empty();
    for (var i=0; i < uporabniki.length; i++) {
      $('#seznam-uporabnikov').append(divElementEnostavniTekst(uporabniki[i]));
    }
  });

  setInterval(function() {
    socket.emit('kanali');
    socket.emit('uporabniki', {kanal: trenutniKanal});
  }, 1000);

  $('#poslji-sporocilo').focus();

  $('#poslji-obrazec').submit(function() {
    procesirajVnosUporabnika(klepetApp, socket);
    return false;
  });
  
  
});

function dodajSmeske(vhodnoBesedilo) {
  var preslikovalnaTabela = {
    ";)": "wink.png",
    ":)": "smiley.png",
    "(y)": "like.png",
    ":*": "kiss.png",
    ":(": "sad.png"
  }
  for (var smesko in preslikovalnaTabela) {
    vhodnoBesedilo = vhodnoBesedilo.replace(smesko,
      "<img src='http://sandbox.lavbic.net/teaching/OIS/gradivo/" +
      preslikovalnaTabela[smesko] + "' />");
  }
  return vhodnoBesedilo;
}
/*  na podoben nacin, kot smo to poceli pri slikah, bomo mi za podan video link
    zgenerirali pripadajoco kodo */
function dodajVideo(vhodnoBesedilo) {
  /* pridobimo vse video linke */
  /*  !!POZOR!!: ko ti pises regularne izraze v nizu, moras escape znake regularnega
      izraza \ escapati se za niz! Torej \\ namesto \ */
      
  /*  prav tako nepogresljiv vir za tvorbo regularnih izrazov je sledeca spletna
      stran: https://regex101.com/#javascript
  */
  var videoIzraz = new RegExp("https:\\/\\/www\\.youtube\\.com\\/watch\\?v=(\\w*)",'gi');
  
  /*  se ena zelo zabavna lastnost JS rexex .exec funkcije - ona ti ne vrne ven
      vseh zadetkov hkrati, ampak enega po enega, zato moras ti iterirati po
      zanki, dokler njej ne zmanjka izhoda*/
  
  var povezava = null;
  var prvic = true; /* da samo prvic vstavimo preskok v novo vrstico */
  /*  delamo dokler regexu ne zmanjka izhoda (torej dokler ne preiscemo celotnega
      vhodnega besedila) - gremo po eno povezavo naenkrat */
  while((povezava = videoIzraz.exec(vhodnoBesedilo)) != null)
  {
    if(prvic)
    {
      /* video damo v novo vrstico */
      vhodnoBesedilo+=' <br /> ';
      prvic=false;
    }
    /* pripnemo povezavo */
    vhodnoBesedilo+= "<iframe class=\'poslanVideo\' src='https://www.youtube.com/embed/"+povezava[1]+"' allowfullscreen></iframe>"
  }
  return vhodnoBesedilo;
}
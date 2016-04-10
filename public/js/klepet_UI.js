/*  dana funkcija se klice, ko od streznika prispe novo sporocilo
    (tudi nase, ker odjemalec najprej poslje strezniku ter on njemu nazaj
    njegovo vsebino)
    */
function divElementEnostavniTekst(sporocilo) {
  /* ker se smeskoti pretvorijo na strani odjemalca ter ker se streznik popolnoma
     nic ne sekira glede zaporedij, ki bi morda lahko bili koda, lahko prvotno
     detekcijo smeskotov ker odstranimo - ti so navsezadnje le slike */
  //var jeSmesko = sporocilo.indexOf('http://sandbox.lavbic.net/teaching/OIS/gradivo/') > -1;
  /* uporabimo regularne izraze
     https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions
  */
   
  var jeSlika = (new RegExp("(?:http|https)://[^ ]*[.]{1}(?:jpg|png|gif)","gi")).test(sporocilo);
  
  if (jeSlika) {
    /*  nekoliko sem popravil regex, ker drugace je stvar neuporabna za vse
        formate slik - vem da zgleda grozno, ampak dlje casa ko buljis v to,
        bolj ti bo vsec
    */
    sporocilo = sporocilo.replace(/\</g, '&lt;').replace(/\>/g, '&gt;').
                /* za nove vrstice */
                replace(new RegExp("&lt;br \/&gt;","gi"),"<br />").
                /* za povezave na dejanske slike */
                replace(new RegExp("&lt;(img((?!&gt;).)*[.]{1}(?:jpg|png|gif)\') \/&gt;","gi"),"<$1 />");
    return $('<div style="font-weight: bold"></div>').html(sporocilo);
  }
  else {
    return $('<div style="font-weight: bold;"></div>').text(sporocilo);
  }
}

function divElementHtmlTekst(sporocilo) {
  return $('<div></div>').html('<i>' + sporocilo + '</i>');
}
/* dana funkcija preoblikuje vnos uporabnika se predno je to poslano strezniku*/
function procesirajVnosUporabnika(klepetApp, socket) {
  var sporocilo = $('#poslji-sporocilo').val();
  sporocilo = dodajSlike(sporocilo);
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
      preslikovalnaTabela[smesko] + "' />","g");
  }
  return vhodnoBesedilo;
}
function dodajSlike(vhodnoBesedilo) {
  /* veljaven vhodni link je tisti, ki se zacne s http/https, konca jpg/png/gif
     vmes pa vsebuje (mi bomo kar pospolosili zadevo in v grobem rekli) vse
     znake razen presledka - ce je ta ze znotraj URI slike, je ta kodiran */
  var slikaIzraz = new RegExp("(?:http|https)://[^ ]*[.]{1}(?:jpg|png|gif)","gi");
  /* pridobimo vse povezave */
  var povezave = vhodnoBesedilo.match(slikaIzraz, '<img class=\'poslanaSlika\' src=\'$&\' />');
  
  /*  mi seveda poskusamo dodajati le takrat, ko imamo kaj za dodati - .match v
      primeru praznega zadetka namrec vrne null, ki pa nima .length atributa,
      zato bi se funkcija sesula */
  if(povezave != null)
  {
    /* slike damo v novo vrstico */
    vhodnoBesedilo+='<br />';
    /* pripnemo dodane slike na konec sporocila */
    for(var i=0; i<povezave.length; i++)
    {
      console.log(povezave[i]);
      vhodnoBesedilo+='<img class=\'poslanaSlika\' src=\''+povezave[i]+'\' />';
    }
  }
  return vhodnoBesedilo;
}

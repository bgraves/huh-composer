var map, position;

var overlays = [];
var markers = [];
var beacons = [];

var loadedWalk;

var remove = function(obj, array) {
  var i = array.indexOf(obj);
  if(i != -1) array.splice(i, 1);
};

var checkHash = function() {
    switch(location.hash) {
      case '#beacons':
        editBeacons();
        break;
      case '#map':
        editMap();
        break;
    }
}

var editMap = function() {
  $('.nav-map').addClass('active');  
  $('.nav-beacons').removeClass('active');  
  $('.beacons').addClass('hidden');
};

var editBeacons = function() {
  $('.nav-beacons').addClass('active');  
  $('.nav-map').removeClass('active');  
  $('.beacons').removeClass('hidden');
  drawBeacons();

  $('.beacons .add').click(function(e) {
    uploadFile($('#beacon-sound-form')[0], function(obj, err) {
      if(err) {
        handleError('Sound upload failed');
      } else {
        handleMessage('Sound file was received');
        var uuid = $('.beacons input[name=uuid]').val();
        var major = $('.beacons input[name=major]').val();
        var minor = $('.beacons input[name=minor]').val();
        var radius = $('.beacons input[name=radius]').val();
        var beacon = { 'uuid': uuid, 'major': major, 'minor': minor, 'radius': radius, 'file': obj.sound.filename };
        beacons.push(beacon);

        drawBeacons();
        $('.beacons form')[0].reset(); 
      }
    });
  });
};

var drawBeacons = function() {
  $('.beacon:not(.hidden)').remove();
  for(var i = 0; i < beacons.length; i++) {
    var beacon = beacons[i];
    var $template = $('.beacon.hidden').clone();
    var composite = beacon.uuid + ' ' + beacon.major + ' ' + beacon.minor;
    $('.uuid', $template).html(composite);    
    $('.radius strong', $template).html(beacon.radius);
    $('.radius .remove', $template).attr('beacon-uuid', composite);
    $template.attr('beacon-uuid', composite);
    $template.removeClass('hidden');
    $('.beacons .list-group').append($template);
  }  

  $('.beacon .remove').click(function(e) {
    var uuid = $(e.target).attr('beacon-uuid');
    var tempBeacons = [];
    for(var i = 0; i < beacons.length; i++) {
      var beacon = beacons[i];
      var composite = beacon.uuid + ' ' + beacon.major + ' ' + beacon.minor;
      if(composite != uuid) {
        tempBeacons.push(beacon);
      } else {
        var url = 'http://api.hearushere.nl/delete?file=' + beacon.file;
        $.get(url).fail(function(err) {
          handleError('Failed to delete sound');
        });
        $('[beacon-uuid='+composite+']').remove();
      }
    }
    beacons = tempBeacons;
  });
};

// Legacy actions - JBG

var handleForm = function(marker) {
  var el = $('.location-details');
  el.removeClass('hidden');
  if(marker.radius)
    $('input[name=radius]', el).val(marker.radius);

  $('button[name=save]', el).click(function(e) {
    if(marker.file) deleteFile(marker);
    if(marker.circle) marker.circle.setMap(null);

    marker.radius = parseInt($('input[name=radius]', el).val());
    el.addClass('hidden');

    addCircle(marker);
    uploadFile($('#sound-form')[0], function(obj, err) {
      if(err) {
        handleError('Sound upload failed');
      } else {
        marker.file = obj.sound.filename;
        handleMessage('Sound file was received');
      }
      $('form', el)[0].reset(); 
    });
  });

  $('button[name=delete]', el).click(function(e) {
    remove(marker, markers);
    if(marker.circle) marker.circle.setMap(null);
    marker.setMap(null);
    el.addClass('hidden');
    deleteFile(marker);
    $('form', el)[0].reset();
  });
};

var deleteFile = function(marker) {
  if(!marker.file) return;
  var url = 'http://api.hearushere.nl/delete?file=' + marker.file;
  $.get(url).fail(function(err) {
    handleError('Failed to delete sound');
  });
};

var uploadFile = function(form, callback) {
  var prog = 0;
  $('.upload').removeClass('hidden');
  var updateProg = function() {
    prog++;
    $('.progress-bar').css('width', prog + '%');
    $('.progress-bar').attr('aria-valuenow', prog + '%');
    if(prog < 90) setTimeout(updateProg, 1000);
  };
  updateProg();

  var data = new FormData(form);
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', function(e) {
    prog = 100;
    updateProg();
    setTimeout(function() {
      $('.upload').addClass('hidden');
    }, 2000);

    var obj = JSON.parse(e.target.responseText);
    if(callback) callback(obj);
  }, false);
  xhr.addEventListener('error', function(err) {
    if(callback) callback(null, err);
  }, false);
  xhr.open('POST', 'http://api.hearushere.nl/upload');
  xhr.send(data);
};

var initMap = function() {
  var mapOptions = {
    zoom: 100,
    center: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
    mapTypeId: google.maps.MapTypeId.TERRAIN
  };
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
  initDrawingManager(map);
};

var initDrawingManager = function(map) {
  var drawingManager = new google.maps.drawing.DrawingManager({
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.MARKER,
        google.maps.drawing.OverlayType.POLYGON
      ]
    }
  });
  drawingManager.setMap(map);

  google.maps.event.addListener(drawingManager, 'overlaycomplete', function(e) {
    if (e.type == google.maps.drawing.OverlayType.POLYGON) {
      var overlay = e.overlay;
      overlays.push(overlay);  
      google.maps.event.addListener(overlay, 'click', function() {
        remove(overlay, overlays);
        overlay.setMap(null);
      });


    } else if (e.type == google.maps.drawing.OverlayType.MARKER) {
      var marker = e.overlay;
      markers.push(marker);
      google.maps.event.addListener(marker, 'click', function() {
        handleForm(marker);
      });
      handleForm(marker);
    }
  });
};

var handleSave = function() {
  var el = $('.save-walk');
  el.removeClass('hidden');
  $('button[name=cancel]', el).click(function(e) {
    el.addClass('hidden');
  });

  if(loadedWalk) {
    $('input[name=title]', el).val(loadedWalk.title);
    $('textarea[name=title]', el).val(loadedWalk.description);
  }

  $('button[name=save-walk]', el).click(function(e) {
    var title = $('input[name=title]', el).val();
    var description = $('textarea[name=description]', el).val();
    if(!title) handleError('You must provide a title'); 
    else {
      generate({
        title: title,
        description: description 
      });
      el.addClass('hidden');
    }
  });
};

var handleOpen = function() {
  $('.open-walk').removeClass('hidden');
  $('button[name=open-walk]').click(function(e) {
    var title = $('.open-walk input[name=title]').val();
    var urlStr = 'http://api.hearushere.nl/walks/' + title; 
    $.get(urlStr, function(data) {
      $('.open-walk').addClass('hidden');
      loadWalk(data);
    }).fail(function() {
      handleError('Failed to find walk "' + title + '"');  
    });
  });
};

var handleError = function(message) {
  $('.alert-danger').html('<strong>Oh snap!</strong> ' + message);
  $('.alert-danger').removeClass('hidden');
  setTimeout(function() {
    $('.alert-danger').addClass('hidden');
  }, 3000);
};

var handleMessage = function(message) {
  $('.alert-success').html('<strong>Success!</strong> ' + message);
  $('.alert-success').removeClass('hidden');
  setTimeout(function() {
    $('.alert-success').addClass('hidden');
  }, 3000);
};

var init = function() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(handlePosition);
  } else {
    alert('Geolocation is not supported by this browser.');
  }
};

var handlePosition = function(p) {
  position = p;
  initMap();
};

var addCircle = function(marker) {
  marker.circle = new google.maps.Circle({
    map: map,
    center: marker.getPosition(),
    radius: marker.radius,
    fillColor: '#fdd511'
  });
};

var generate = function(walk) {
  walk.sounds = [];
  uploadFile($('#walk-form')[0], function(obj, err) {
    if(err) {
      handleErr('Error saving walk');
      return;
    } else {
      if(obj.sound) {
        walk.sounds.push({
          background: true,
          file: obj.sound.filename,
        });
      }
      if(obj.image) walk.image = obj.image.filename; 
      completeWalk(walk);
    }
  });
};

var completeWalk = function(walk) {
  //Create the areas - JBG
  walk.areas = [];
  for(var i = 0; i < overlays.length; i++) {
    var overlay = overlays[i];
    var verts = overlay.getPath().getArray();
    var area = [];
    for(var j = 0; j < verts.length; j++) {
      var vert = verts[j];
      area.push(vert.k); 
      area.push(vert.D); 
    }
    walk.areas.push(area);
  }

  //Create GPS sounds - JBG
  for(var i = 0; i < markers.length; i++) {
    var marker = markers[i];
    var pos = marker.getPosition();
    walk.sounds.push({
      location: [pos.k, pos.D],
      file: marker.file,
      radius: marker.radius
    }); 
  }

  // Create beacon sounds - JBG
  for(var i = 0; i < beacons.length; i++) {
    var beacon = beacons[i];
    beacon.bluetooth = true;
    walk.sounds.push(beacon);
  }

  // Send to server - JBG
  var url = 'http://api.hearushere.nl/walks';
  $.ajax({
    url: url,
    type:"POST",
    data: JSON.stringify(walk),
    contentType: "application/json; charset=utf-8",
    dataType :"json"
  }).done(function(data) {
    handleMessage('Walk saved');
  }).fail(function(err) {
    handleError('Failed to save walk');
  });
};

var loadWalk = function(walk) {
  if(walk.status && walk.status == 'error') {
    alert(walk.message);
    return;
  }
  clearMap();
  loadedWalk = walk;
  for(var i = 0; i < walk.areas.length; i++) {
    var area = walk.areas[i];
    var coords = [];
    for(var j = 0; j < area.length; j+=2) {
      coords.push(new google.maps.LatLng(area[j], area[j+1]));
      var overlay = new google.maps.Polygon({
        path: coords
      });
    }
    overlay.setMap(map);
    overlays.push(overlay);
    google.maps.event.addListener(overlay, 'click', function() {
      remove(overlay, overlays);
      overlay.setMap(null);
    });
  }
  for(var i = 0; i < walk.sounds.length; i++) {
    var sound = walk.sounds[i];
    if(sound.location) {
      var coord = new google.maps.LatLng(sound.location[0], sound.location[1]);
      var marker = new google.maps.Marker({
        file: sound.url,
        radius: sound.radius,
        position: coord,
        map: map
      });
      markers.push(marker);
      google.maps.event.addListener(marker, 'click', function() {
        handleForm(this);
      });
      addCircle(marker);
    } else if(sound.uuid) {
      beacons.push(sound);
    }
  }
  drawBeacons();
};

var clearMap = function() {
  for(var i = 0; i < overlays.length; i++) {
    var overlay = overlays[i];
    overlay.setMap(null);
  }
  overlays = [];
  for(var i = 0; i < markers.length; i++) {
    var marker = markers[i];
    marker.circle.setMap(null);
    marker.setMap(null);
  }
  markers = [];
  beacons = [];
  drawBeacons();
  loadedWalk = {};
};

(function () {
  $('#new-menu-item').click(function(e) {
    clearMap();
  }); 
  $('#save-menu-item').click(function(e) {
    handleSave();
  }); 
  $('#open-menu-item').click(function(e) {
    handleOpen();
  }); 

  window.onhashchange = function() {
    checkHash();
  }
  init();
  checkHash();
})();





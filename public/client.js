const socket = io()

let peer = null
let roomId = null
let remoteSocketId = null
let sendChannel = null
let receiveChannel = null
let receiveBuffer = []
let receivedSize = 0
let expectedFile = {
    name: null,
    size: null,
}

peer = new RTCPeerConnection({
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
});

peer.onicecandidate = (event) => {
    console.log("Found ice candidate" + event.candidate);
    if (event.candidate && remoteSocketId) {
    socket.emit('peer-updated', {
        candidate: event.candidate,
        to: remoteSocketId
    });
    }
};

sendChannel = peer.createDataChannel("chat", {
    negotiated: true,
    id: 0
});
// sendChannel.binaryType = 'arraybuffer';
// sendChannel.onopen = () => console.log("Send channel opened");
// sendChannel.onmessage = onReceiveMessageCallback;
// peer.addEventListener('datachannel', receiveChannelCallback);

const sendButton = document.getElementById('share-file')
const joinButton = document.getElementById('join-room')

sendButton.addEventListener('click', (e) => handleFileShare(e));
joinButton.addEventListener('click', (e) => handleRoomJoin(e));

async function handleFileShare(e) {
    e.preventDefault();
    console.log("Creating room");
    createRoom();
    fileInput = document.getElementById('input-file')
    const file = fileInput.files[0]
    if (!file) {
        alert('Please select a file')
        return
    }
    if (!file.size) {
        alert('File is empty')
        return
    }
}

function sendFileOverDataChannel() {
    fileInput = document.getElementById('input-file')
    if (fileInput.files.length == 0) {
        console.log("No file selected");
        return;
    }
    file = fileInput.files[0];
    const chunkSize = 16384;
    fileReader = new FileReader();
    let offset = 0;
    fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    fileReader.addEventListener('load', e => {
        console.log('FileRead.onload ', e);
        sendChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        if (offset < file.size) {
        readSlice(offset);
        }
    });
    const readSlice = o => {
        console.log('readSlice ', o);
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
}

function onReceiveMessageCallback(event) {

    if (expectedFile.size == null) {
        console.log("Expected file size is null");
        return;
    }
    document.getElementById('incoming-filename').innerText = expectedFile.name;
    var elem = document.getElementById('filemetadata');
    elem.style.display = 'block';

    console.log(`Received Message ${event.data.byteLength}`);
    receiveBuffer.push(event.data);
    receivedSize += event.data.byteLength;
  
    // we are assuming that our signaling protocol told
    // about the expected file size (and name, hash, etc).
    // const file = fileInput.files[0];
    if (receivedSize === expectedFile.size) {
      const received = new Blob(receiveBuffer);
      receiveBuffer = [];
      
      var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";

  
      a.href = URL.createObjectURL(received);
      a.download = expectedFile.name;
      a.click();
      URL.revokeObjectURL(a.href);
  
      closeDataChannels();
    }
  }

  function closeDataChannels() {
    console.log('Closing data channels');
    sendChannel.close();
    reset();
  }

async function handleRoomJoin(e) {
    e.preventDefault();
    console.log("Joining room");
    joinRoom();
}

function createRoom() {
    roomId = crypto.randomUUID();
    socket.emit('create-room', roomId)
}

function joinRoom() {
    roomId = document.getElementById('room-id').value;
    passKey = document.getElementById('passkey').value;
    if (!roomId || !passKey) {
        alert('Please enter room id and passkey')
        return
    }
    // Emit an event to the server to join a room
    socket.emit('join-room', {room: roomId, passKey: passKey});
}

function reset() {
    peer = null
    roomId = null
    remoteSocketId = null
    sendChannel = null
    receiveBuffer = []
    receivedSize = 0
}


// Event listeners for socket events

socket.on('peer-updated', async data => {
    const {from, candidate} = data;
    peer.addIceCandidate(new RTCIceCandidate(candidate))
    .catch((error) => {
        console.error('Error adding ICE candidate:', error);
    });
    console.log("Added new ice candidate");
});


socket.on('joined-room', roomId => {
    console.log("Joined room: " + roomId);
    roomId = roomId;
    // Set event listeners for data channel after room is joined
    sendChannel.onmessage = onReceiveMessageCallback;
});

socket.on('created-room', data => {
    console.log("Created room: ", data);
    roomId = data.roomId;
    passKey = data.passKey;
    document.getElementById('generated-passkey').innerText = passKey;
    document.getElementById('generated-room-id').innerText = roomId;
    var elem = document.getElementById('sender-info');
    elem.style.display = 'block';
});

socket.on('error', msg => {
    alert(msg);
});

socket.on('peer-joined', (to) => {
    fileInput = document.getElementById('input-file')
    const file = fileInput.files[0]
    // Send file metadata to peer
    socket.emit(
        'file-metadata',
        {
            metadata: { name: file.name, size: file.size },
            to: to
        }
    );
    initializePeerConnection(to);
});

socket.on('offer-request', async data => {
    const { from, offer } = data;
    console.log("Incoming offer for webRTC from:" + from);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    console.log("Set Remote Description:" + offer);

    const answereOffer = await peer.createAnswer();
    console.log("Created answer offer:" + answereOffer);
    await peer.setLocalDescription(new RTCSessionDescription(answereOffer));
    console.log("Set Local Description:" + answereOffer);

    socket.emit('offer-answer', { answere: answereOffer, to: from });
    remoteSocketId = from;
});

socket.on('offer-answer', async data => {
    console.log("Received answer from peer");
    const { offer } = data;
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    console.log("Set Remote description after answer received from peer: ", offer);
    
    // Set event listener for data channel after peer connection is established
    sendChannel.onopen = sendFileOverDataChannel;
});

socket.on('file-metadata', data => {
    console.log("Received file metadata from peer");
    const {metadata} = data;
    expectedFile.name = metadata.name;
    expectedFile.size = metadata.size;
    console.log("Set expected file metadata: ", expectedFile);
});

async function initializePeerConnection(remoteSocketId) {
    console.log("Remote Socket ID: "+ remoteSocketId);
    remoteSocketId = remoteSocketId;
    const localOffer = await peer.createOffer();
    console.log("Set local description for creating call: " + localOffer);
    await peer.setLocalDescription(new RTCSessionDescription(localOffer));
    socket.emit('offer-request', { fromOffer: localOffer, to: remoteSocketId });
}



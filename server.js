// Server for p2p file transfer

const http = require('http')
const express = require('express')
const socktIo = require('socket.io')
const crypto = require('crypto');
const path = require('path')

const app = express() // Create express app
const server = http.createServer(app) // Create http server using express app
const io = socktIo(server) // Wrap http server with socket.io

PORT = 3005

let rooms = {}
let userRoomMap = {}

app.use(express.static( path.resolve('./public') ));

app.get("/health", (req, res) => {
    return res.json({"status": "ok"});
})

io.on('connection', socket => {
    console.log(`User connected ${socket.id}`)

    socket.on('create-room', roomId => {
        console.log('Creating room', roomId)
        if (userRoomMap[socket.id]) {
            socket.emit('error', 'You are already in a room')
        } else {
            console.log('Creating room', roomId)
            passKey = crypto.randomInt(100000, 999999)
            rooms[roomId] = {ownerId: socket.id, passKey: passKey}
            userRoomMap[socket.id] = roomId
            socket.emit('created-room', {roomId: roomId, passKey: passKey})
        }
    })

    socket.on('join-room', data => {
        if (userRoomMap[socket.id]) {
            socket.emit('error', 'You are already in a room')
        } else {
            console.log('Trying to join room', data)
            if(!rooms[data.room]) {
                socket.emit('error', 'Room does not exist')
            } else {
                if (rooms[data.room].peer) {
                    socket.emit('error', 'Room is full')
                } else if(rooms[data.room].passKey != data.passKey) {
                    socket.emit('error', 'Incorrect passkey')
                } else {
                    userRoomMap[socket.id] = data.room // Map user to room
                    rooms[data.room].peer = socket.id // Map peer to room
                    socket.emit('joined-room', data.room) // Notify user that they have joined the room
                    socket.to(rooms[data.room].ownerId).emit('peer-joined', socket.id) // Notify owner that peer has joined
                }
            }
        }
    })

    // Forward offer request to peer
    socket.on('offer-request', data => {
        const {fromOffer, to} = data
        socket.to(to).emit('offer-request', {from: socket.id, offer: fromOffer})
    })

    // Forward answer to peer
    socket.on('offer-answer', data => {
        const { answere, to } = data;
        socket.to(to).emit('offer-answer', { from: socket.id, offer: answere });
    });

    socket.on('peer-updated', data => {
        const { candidate, to } = data;
        socket.to(to).emit('peer-updated', { from: socket.id, candidate: candidate });
    });

    socket.on('file-metadata', data => {
        console.log('Forwarding file metadata', data)
        const { metadata, to } = data;
        socket.to(to).emit('file-metadata', { from: socket.id, metadata: metadata });
    })

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle user disconnection, leave rooms, etc.

        if(userRoomMap[socket.id]) {
            const room = userRoomMap[socket.id]
            if (rooms[room]==undefined)
            {
                delete userRoomMap[socket.id]
                return;
            }
            if (rooms[room].ownerId == socket.id) {
                // Notify peer that owner has left
                socket.to(rooms[room].peer).emit('owner-left')
                // Delete room
                delete rooms[room]
            } else {
                // Notify owner that peer has left
                socket.to(rooms[room].ownerId).emit('peer-left')
                // Delete peer from room
                delete rooms[room].peer
            }
            // Delete user from room map
            delete userRoomMap[socket.id]
        }

      });


})


server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
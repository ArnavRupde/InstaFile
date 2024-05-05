# InstaFile
## InstaFile - Instantly transfer files between browsers

# Features
- Share files in peer to peer manner
- Uses WebRTC data channels for ordered and reliable data transfer between browsers
- Uses Websocket server only for signalling
- No limit on maximum file size

# Tech stack
- Node JS (For Websocket signalling server)
- Javascript (For Frontend and WebRTC logic)
- Tailwind CSS (For Styling)
- Docker (For containerization)

# How to run
- Build docker image ( `docker build -t instafile:1.0 .` )
- Run docker container ( `docker run -p 3005:3005 instafile:1.0` )

# How it works?
- Create NodeJS websocket server for signalling
- Whenever a user uploads a file, websocket server adds user to random room
- Server generate random room id and passkey
- When receiver provides same room id and passkey, we create a WebRTC peer connection
- Both browsers exechange their SDP for WebRTC communication
- Once connection established, a data channel is created on top of peer connection
- By default, data channels will use ordered and reliable transfer method
- Data is sent in small chunks over the channel
- Once receiver gets all chunks, the blob is downloaded as file at receiver end


# Demo

Sender
<img width="1715" alt="Screenshot 2024-05-05 at 5 51 02 PM" src="https://github.com/ArnavRupde/InstaFile/assets/34592221/e6b6da9b-b34c-4973-91a2-6978bdbeeab2">

Receiver
<img width="1715" alt="Screenshot 2024-05-05 at 5 51 19 PM" src="https://github.com/ArnavRupde/InstaFile/assets/34592221/22899476-9a7b-4fa2-a25b-fc37c8a244db">

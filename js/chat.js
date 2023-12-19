var nowchat100 = 0
var nowHeight = 0
var isStarted = false

function blankCheck(text, alertmsg){
    if(text == '' || text == null ){
        alert(alertmsg);
        return false;
    }
    var blank_pattern = /^\s+|\s+$/g;
    if(text.replace( blank_pattern, '' ) == "" ){
        alert(alertmsg);
        return false;
    }
    return true
}

function scrollBottom(){
   $('#chat-scrolls').scrollTop($('#chat-scrolls')[0].scrollHeight)
}

function isScrollTop(){
    var scrollTop = $('#chat-scrolls').scrollTop()
    if (scrollTop < 30) {
        return true;
    }
}

function sendChat(socket){
    //데이터 체크
    var msg = $("#message-input").val()
    var nickname = $("#name-input").val()
    
    if(!blankCheck(msg, '내용을 입력해주세요')){
        return false
    }
    if(!blankCheck(nickname, '닉네임은 공백일 수 없습니다')){
        return false
    }

    socket.emit("chat", {msg: msg, nickname: nickname})

    //메시지 내용 삭제
    $("#message-input").val('')
}

$(document).ready(() => {
    //초기 닉네임 설정
    $("#name-input").val(myname)
    //소켓서버열기
    var socket = io();

    $('input#name-input').on('change keyup paste', () => {
        socket.emit('name-cookie', $(this).val)
    })

    $("input#message-input").keydown((key) => {
        if(key.keyCode == 13){
            scrollBottom()
            sendChat(socket)
        }
    })

    $("button[id='submit']").click(()=>{
        sendChat(socket)
        scrollBottom()
    })

    //스크롤 맨위 감지
    $('#chat-scrolls').scroll(()=>{
        if(isScrollTop()){ //맨위면
            nowHeight = $('#chat-scrolls')[0].scrollHeight - $('#chat-scrolls').scrollTop()
            if(nowchat100 != 0){ //다 로드되지 않았다면
                socket.emit('chatListReq', nowchat100 - 1) //요청보내기
                nowchat100 -= 1
            }
        }
    })

    socket.on('newchat', (data) =>{ //새로운 채팅
        var isBottom = false

        //현재 맨 밑 여부
        if($('#chat-scrolls').scrollTop() + $('chat-scrolls').innerHeight() >= $('#chat-contents').height()){
            isBottom = true
        }
        console.log(isBottom)

        $('#chat-contents').append(`
        <div id="one-chat" style="text-align: left;">
            ${data.nickname}: ${data.msg} 
        </div>
        `)

        //스크롤 맨 밑
        //if(isBottom){
            scrollBottom()
        //}
    })
    socket.on('chatList', (data) => { //채팅 리스트 얻어오기
        if(isStarted){
            return 0
        }
        chatList = data.chatList
        nowchat100 = data.nowchat100
        for(var i = 0; i < chatList.length; i++){
            $('#chat-contents').append(`
            <div id="one-chat" style="text-align: left;">
                ${chatList[i].nickname}: ${chatList[i].msg} 
            </div>
            `)
        }
        scrollBottom()

        if($('#chat-contents').height() < $('#chat-scrolls').height()){ //스크롤바가 없다면
            console.log(nowchat100)
            if(nowchat100 != 0){ //다 로드되지 않았다면
                nowHeight = $('#chat-scrolls')[0].scrollHeight - $('#chat-scrolls').scrollTop()
                socket.emit('chatListReq', nowchat100 - 1) //요청보내기
                nowchat100 -= 1
            }
        }
        isStarted = true
    })
    socket.on('chatListRes', (data) => { //채팅 리스트 얻어오기
        chatList = data.reverse()
        for(var i = 0; i < chatList.length; i++){
            $('#chat-contents').prepend(`
            <div id="one-chat" style="text-align: left;">
                ${chatList[i].nickname}: ${chatList[i].msg} 
            </div>
            `)
        }
        $('#chat-scrolls').scrollTop($('#chat-scrolls')[0].scrollHeight - nowHeight)
    })
})
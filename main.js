var app = require('express')()
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');
var crypto = require('crypto');
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')
var session = require('express-session');
const { json, request } = require('express');
const { application } = require('express');
const { info } = require('console');
var FileStore = require('session-file-store')(session);
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser())
var sessionMiddleware = session({
  resave: false,
  saveUninitialized: false,
  secret: "keyboard cat",
  store : new FileStore()
})
app.use(sessionMiddleware)
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next)
})

//동시 작성 방지 변수
var isWritingCH = []

//필요함수 정의
function readHTML(name){ //html 읽기
    var html = fs.readFileSync('html/' + name + '.html', 'utf-8');
    return html
}
function removeTag(text){ //태그 지우기
  return text.replace(/</gi, '&lt').replace(/>/gi, '&gt')
}
function chatCount(roomName){ //채팅수 확인
  newChatRoom(roomName)
  return JSON.parse(fs.readFileSync('data/' + roomName + '/info.json', 'utf-8')).chatCount
}
function chatCountAppend(roomName){ //채팅수 증가
  var infoData = {
    chatCount: chatCount(roomName) + 1
  }
  fs.writeFileSync('data/' + roomName + '/info.json', JSON.stringify(infoData))
  return infoData.chatCount
}
function newChatRoom(roomName){ //새로운 채팅방
  if(fs.existsSync('data/' + roomName)){
    return true
  }
  else{
    fs.mkdirSync('data/' + roomName)
    var infoData = {
      chatCount: 2
    }
    fs.writeFileSync('data/' + roomName + '/info.json', JSON.stringify(infoData))
    var startMsg = [ 
      {
        nickname: removeTag('개발자'),
        msg: removeTag('여기는 ' + roomName + ' 채팅방입니다.'),
        id: 0
      },
      {
        nickname: removeTag('개발자'),
        msg: removeTag('자유롭게 채팅해 주세요 :)'),
        id: 1
      }
    ]
    fs.writeFileSync('data/' + roomName + '/' + '0.json', JSON.stringify(startMsg))
  }
}
function chatRead(roomName, chat100){
  if(!fs.existsSync('data/' + roomName + '/' + chat100 + ".json")){
    return null
  }
  var chats = JSON.parse(fs.readFileSync('data/' + roomName + '/' + chat100 + ".json", 'utf-8'))
  return chats
}
function chatSave(roomName, msgData){ //새 채팅 내용 저장
  newChatRoom(roomName)
  var count = chatCount(roomName)
  var fileName = Math.floor(count / 100) //100의 자리 숫자
  fileName += ".json"
  if(!fs.existsSync('data/' + roomName + '/' + fileName)){
    fs.writeFileSync('data/' + roomName + '/' + fileName, '[]')
  }
  var chats = JSON.parse(fs.readFileSync('data/' + roomName + '/' + fileName, 'utf-8'))
  chats[chats.length] = msgData
  fs.writeFileSync('data/' + roomName + '/' + fileName, JSON.stringify(chats))
  chatCountAppend(roomName)
}

//암호화
function makeHash(password, salt){
  var hashPassword = crypto.createHash("sha512").update(password + salt).digest("hex");
  return hashPassword
}
//소금뿌리기
function makeSalt(){
  return Math.round((new Date().valueOf() * Math.random())) + ""
}
//랜덤
function rand(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

//시간변환
function getTermText(time){
  var now = (+ new Date()) / 1000
  var time2 = time / 1000
  var termText = ''
  var term = now - time2
  if(term < 60){
    termText = Math.round(term) + '초 전'
  }
  else if(term < 60 * 60){
    termText = Math.round(term / 60) + '분 전'
  }
  else if(term < 60 * 60 * 24){
    termText = Math.round(term / (60 * 60)) + '시간 전'
  }
  else if(term < 60 * 60 * 24 * 30.4375){
    termText = Math.round(term / (60 * 60 * 24)) + '일 전'
  }
  else if(term < 60 * 60 * 24 * 30.4375 * 12){
    termText = Math.round(term / (60 * 60 * 24 * 30.4375)) + '달 전'
  }
  else{
    termText = Math.round(term / (60 * 60 * 24 * 30.4375 * 12)) + '년 전'
  }
  return termText
}


function newUserDir(){ 
  if(fs.existsSync('users')){
    return true
  }
  else{
    fs.mkdirSync('users')
  }
}
//유저 저장
function saveUser(UserOBJ){
  newUserDir()
  if(fs.existsSync('users/' + UserOBJ.id)){
    return false
  }
  else{
    fs.mkdirSync('users/' + UserOBJ.id)
  }
  fs.writeFileSync('users/' + UserOBJ.id + '/info.json', JSON.stringify(UserOBJ))
  return true
}
//유저 인출
function openUser(UserID){
  newUserDir()
  if(fs.existsSync('users/' + UserID)){
    return JSON.parse(fs.readFileSync('users/' + UserID + '/info.json', 'utf-8'))
  }
  else{
    return false
  }
}

//replace
function replaceAll(str, searchStr, replaceStr){
  return str.split(searchStr).join(replaceStr); 
}


function topNavAddHTML(original, request){
  var html = replaceAll(original, '${top-nav-bar}', readHTML('top-nav-bar'))
  if(request.session.logined == true){
    html = html.replace('로그인하지 않음', request.session.user_id).replace('로그인 ←', '로그아웃 →')
  }
  return html
}

function changeElements(original, elist){
  var text = original
  for(var i = 0; i < elist.length; i++){
    text = replaceAll(text, '${' + elist[i]['key'] + '}', elist[i]['value'])
  }
  return text
}

function toHTMLText(text){
  return replaceAll(replaceAll(replaceAll(text, '>', '&gt;'), '<', '&lt;'), '\n', '<br>')
}


//메인
app.get('/', function(request, response) {
  var html = readHTML('main')

  //과목 리스트
  var dirPath = './novels'
  var btnsText = ''
  var novelFileList = fs.readdirSync(dirPath)
  var novelList = []
  for(var i = 0; i < novelFileList.length; i++){
    novelList[i] = novelFileList[i]
  }
  novelList.sort((a, b) => b.time - a.time)
  for(var i = 0; i < novelList.length; i++){
    btnsText += `
    <button class="book-surface" onclick="location.href='/subject/${novelList[i]}'"><span>${novelList[i]}</span></button>`
  }
  html = changeElements(html, [{'key': 'list-subjects', 'value': btnsText}])

  response.send(topNavAddHTML(html, request))
});

//과목별
app.get('/subject/:subject', function(request, response) {
  var html = readHTML('subject')

  //소설 리스트
  var dirPath = './novels/' + request.params.subject + '/'

  if(!fs.existsSync(dirPath)){
    var html = readHTML('main') + '<script>alert("잘못된 접근입니다."); location.replace("/")</script>'
  }
  else{
    var btnsText = ''
    var novelFileList = fs.readdirSync(dirPath)
    var novelList = []
    for(var i = 0; i < novelFileList.length; i++){
      novelList[i] = JSON.parse(fs.readFileSync(dirPath + '/' + novelFileList[i]))
    }
    novelList.sort((a, b) => b.time - a.time)
    for(var i = 0; i < novelList.length; i++){
      btnsText += `
      <button class="book-surface" onclick="location.href='/novel/${request.params.subject}/view/${novelList[i].id}'"><span>${novelList[i].title}</span>
      <span style="font-size: 0.6em;"><br>${getTermText(novelList[i].time)}</span></button>`
    }
    html = changeElements(html, [{'key': 'list-novels', 'value': btnsText}, {'key': 'subject', 'value': request.params.subject}])
  }
  response.send(topNavAddHTML(html, request))
});


//로그인
app.get('/login', function(request, response) {
  if(request.session.logined == true){
    request.session.logined = false
    response.redirect('/')
  }
  else{
    var html = readHTML('login')
    response.send(topNavAddHTML(html, request))
  }
});

//새로운 소설 작성
app.get('/novel/:subject/new', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('new-novel')
  }
  else{
    var html = readHTML('main') + '<script>alert("소설 작성은 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }
  html = changeElements(html, [{'key': 'title-input', 'value': ''}, {'key': 'text-input', 'value': ''}, {'key': 'subject', 'value': request.params.subject}])
  response.send(topNavAddHTML(html, request))
});

//소설 이어쓰기
app.get('/novel/:subject/view/add/:id', function(request, response) {
  novelFilePath = './novels/' + request.params.subject + '/' + request.params['id'] + '.json'
  //if(Object.keys(isWritingCH).indexOf(request.params.id) == -1){
  //  isWritingCH[request.params.id] = {'isWriting':false}
  //}
    if(fs.existsSync(novelFilePath)){ //파일이 있는가?
      if(request.session.logined == true){
        var html = readHTML('add-novel')
        var novelFile = JSON.parse(fs.readFileSync(novelFilePath)) //파일 열기
        var novelText = toHTMLText(novelFile.paragraph[novelFile.paragraph.length - 1].history[0].text)
        var novelTitle = novelFile.title
        html = changeElements(html, [{'key': 'novel-id', 'value': request.params.id}, {'key': 'novel-title', 'value': novelTitle}, {'key': 'novel-text', 'value': novelText},
      {'key': 'text-input', 'value': ''},{'key': 'subject', 'value': request.params.subject}])
      }
      else{
        var html = readHTML('novel-view') + `<script>alert("질문에 답하기는 로그인 후 이용 가능합니다."); location.replace("/novel/${request.params.subject}/view/${request.params['id']}")</script>`
      }
    }
    else{
      var html = readHTML('main') + '<script>alert("잘못된 접근입니다. 파일 없음."); location.replace("/")</script>'
    }
  response.send(topNavAddHTML(html, request))
});

//소설 보기
app.get('/novel/:subject/view/:id', function(request, response) {
  //파일 경로
  novelFilePath = './novels/' + request.params.subject + '/' + request.params['id'] + '.json'
  console.log(novelFilePath)
  if(fs.existsSync(novelFilePath)){ //파일이 있는가?
    var html = readHTML('novel-view') //html 불러오기
    var novelFile = JSON.parse(fs.readFileSync(novelFilePath)) //파일 열기
    var paragraphText = '<br>────────────────────────<br><br>'
    for(var i = 0; i < novelFile.paragraph.length; i++){
      if(i == 0){
        paragraphText += "<span style='font-size:2em'>질문</span><br><br>"
      }
      else{
        paragraphText += "<span style='font-size:2em'>답변" + i + "</span><br><br>"
      }
      paragraphText += toHTMLText(novelFile.paragraph[i].history[novelFile.paragraph[i].history.length - 1].text) + '<br><br>────────────────────────<br><br>'
    }

    var peopleList = []
    for(var i = 0; i < novelFile.paragraph.length; i++){
      if(peopleList.indexOf(toHTMLText(novelFile.paragraph[i].author)) == -1 && toHTMLText(novelFile.paragraph[i].author) != novelFile.author){
        peopleList[peopleList.length] = toHTMLText(novelFile.paragraph[i].author)
      }
    }
    var peopleText = '질문자: ' + novelFile.author + '<br>답변자: ' + peopleList.join(', ');

    html = changeElements(html, [{'key': 'novel-title', 'value': novelFile.title}, {'key': 'novel-text', 'value': paragraphText}, {'key': 'novel-id', 'value': novelFile.id}, {'key': 'people-text', 'value': peopleText}, {'key': 'subject', 'value': request.params.subject}])
  }
  else{
    var html = readHTML('main') + '<script>alert("잘못된 접근입니다."); location.replace("/")</script>'
  }
  response.send(topNavAddHTML(html, request))
});


//저장 안하고 불러오기(뒤로가기 위함)
app.post("/novel/:subject/load", function(request,res,next){
  request.session.tempSaveValue = {title: '', text:'', subject:request.params.subject}
  request.session.tempSaveValue.title = request.body.novelTitle
  request.session.tempSaveValue.text = request.body.novelText
  res.redirect('/novel/' + request.params.subject + 'load');
})

//저장 안하고 임시저장 불러오기(뒤로가기 위함)
app.post("/novel/:subject/add/load/:num", function(request,res,next){
  request.session['tempSaveAddValue' + request.params.num] = {title: '', text:'', subject:request.params.subject}
  request.session['tempSaveAddValue' + request.params.num].text = request.body.novelText
  res.redirect('/novel/' + request.params.subject + 'view/add/load/' + request.params.num);
})

//임시저장 불러오기
app.get('/novel/:subject/load', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('load-novel')
  }
  else{
    var html = readHTML('main') + '<script>alert("임시저장 불러오기는 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }
  var filePath = './users/' + request.session.user_id + '/tempSave.json'
  var btnsText = ''
  var tempSaveArr = JSON.parse(fs.readFileSync(filePath))
  for(var i = tempSaveArr.length - 1; i >= 0; i--){
    btnsText += `
    <div class="book-surface-div" >
        <button class="book-surface-btn" onclick="location.href='/novel/${request.params.subject}/load/${i}'"><span>${tempSaveArr[i].title}</span>
        <span style="font-size: 0.6em;"><br>${getTermText(tempSaveArr[i].time)}</span></button>
        <button class="delete-btn" onclick="delete1(${i})">DELETE</button>
    </div>`
  }
  html = changeElements(html, [{'key': 'lastNum', 'value': tempSaveArr.length - 1}, {'key': 'list', 'value': btnsText}, {'key': 'subject', 'value': request.params.subject}])
  response.send(topNavAddHTML(html, request))
});


//이어쓰기 임시저장 불러오기
app.get('/novel/:subject/view/add/load/:num', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('add-load-novel')
  }
  else{
    var html = readHTML('main') + '<script>alert("답변 임시저장 불러오기는 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }

  var dirPath = './users/' + request.session.user_id + '/novels'
  if(!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath)
  }
  var filePath = './users/' + request.session.user_id + '/novels/' + request.params.num + '.json'

  var btnsText = ''
  if(fs.existsSync(filePath)){
    var tempSaveArr = JSON.parse(fs.readFileSync(filePath))
    for(var i = tempSaveArr.length - 1; i >= 0; i--){
      btnsText += `
      <div class="book-surface-div" >
          <button class="book-surface-btn" onclick="location.href='/novel/${request.params.subject}/view/load/add/${request.params.num}/${i}'"><span>${tempSaveArr[i].text.substr(0, 10) + '...'}</span>
          <span style="font-size: 0.6em;"><br>${getTermText(tempSaveArr[i].time)}</span></button>
          <button class="delete-btn" onclick="delete1(${i})">DELETE</button>
      </div>`
    }
  }
  html = changeElements(html, [{'key': 'novel-id', 'value': request.params.num}, {'key': 'list', 'value': btnsText}, {'key': 'subject', 'value': request.params.subject}])
  response.send(topNavAddHTML(html, request))
});


//임시저장 삭제
app.get('/novel/:subject/load/del/:num', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('load-novel') + '<script>alert("삭제되었습니다."); location.replace("/novel/' + request.params.subject + 'load")</script>'
  }
  else{
    var html = readHTML('main') + '<script>alert("임시저장 삭제하기는 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }
  var filePath = './users/' + request.session.user_id + '/tempSave.json'
  var btnsText = ''
  var tempSaveArr = JSON.parse(fs.readFileSync(filePath))
  //삭제하기
  if(request.params.num == 'all'){
    tempSaveArr = []
  }
  else{
    tempSaveArr.splice(Number(request.params.num), 1)
  }
  fs.writeFileSync(filePath, JSON.stringify(tempSaveArr))

  for(var i = tempSaveArr.length - 1; i >= 0; i--){
    btnsText += `
    <div class="book-surface-div" >
        <button class="book-surface-btn" onclick="location.href='/novel/${request.params.subject}/load/${i}'"><span>${tempSaveArr[i].title}</span>
        <span style="font-size: 0.6em;"><br>${getTermText(tempSaveArr[i].time)}</span></button>
        <button class="delete-btn" onclick="delete1(${i})">DELETE</button>
    </div>`
  }
  html = changeElements(html, [{'key': 'lastNum', 'value': -1}, {'key': 'list', 'value': btnsText}, {'key': 'subject', 'value': request.params.subject}])
  response.send(topNavAddHTML(html, request))
});


//이어쓰기 임시저장 삭제
app.get('/novel/:subject/add/load/del/:id/:num', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('load-novel') + `<script>alert("삭제되었습니다."); location.replace("/novel/${request.params.subject}/view/add/load/${request.params.id}")</script>`
  }
  else{
    var html = readHTML('main') + '<script>alert("이어쓰기 임시저장 삭제하기는 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }
  
  var dirPath = './users/' + request.session.user_id + '/novels'
  if(!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath)
  }
  var filePath = './users/' + request.session.user_id + '/novels/' + request.params.id + '.json'
  
  var btnsText = ''
  var tempSaveArr = JSON.parse(fs.readFileSync(filePath))
  //삭제하기
  if(request.params.num == 'all'){
    tempSaveArr = []
  }
  else{
    tempSaveArr.splice(Number(request.params.num), 1)
  }
  fs.writeFileSync(filePath, JSON.stringify(tempSaveArr))

  for(var i = tempSaveArr.length - 1; i >= 0; i--){
    btnsText += `
    <div class="book-surface-div" >
        <button class="book-surface-btn" onclick="location.href='/novel/${request.params.subject}/view/load/add/${request.params.id}/${i}'"><span>${tempSaveArr[i].text.substr(0, 10) + '...'}</span>
        <span style="font-size: 0.6em;"><br>${getTermText(tempSaveArr[i].time)}</span></button>
        <button class="delete-btn" onclick="delete1(${i})">DELETE</button>
    </div>`
  }
  html = changeElements(html, [{'key': 'novel-id', 'value': request.params.num}, {'key': 'lastNum', 'value': -1}, {'key': 'list', 'value': btnsText}, {'key': 'subject', 'value': request.params.subject}])
  response.send(topNavAddHTML(html, request))
});


//임시저장 열기
app.get('/novel/:subject/load/:num', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('new-novel')
  }
  else{
    var html = readHTML('main') + '<script>alert("임시저장 불러오기는 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }
  if(request.params.num == 'getback'){
    html = changeElements(html, [{'key': 'title-input', 'value': request.session.tempSaveValue.title}, {'key': 'text-input', 'value': request.session.tempSaveValue.text}, {'key': 'subject', 'value': request.params.subject}])
  }
  else{
    var filePath = './users/' + request.session.user_id + '/tempSave.json'
    var tempSaveArr = JSON.parse(fs.readFileSync(filePath))
  
    if(request.params.num != -1){
      html = changeElements(html, [{'key': 'title-input', 'value': tempSaveArr[request.params.num].title}, {'key': 'text-input', 'value': tempSaveArr[request.params.num].text}, {'key': 'subject', 'value': request.params.subject}])
    }
    else{
      html = changeElements(html, [{'key': 'title-input', 'value': ''}, {'key': 'text-input', 'value': ''}, {'key': 'subject', 'value': request.params.subject}])
    }
  }
  response.send(topNavAddHTML(html, request))
});

//이어쓰기 임시저장 열기
app.get('/novel/:subject/view/load/add/:id/:num', function(request, response) {
  if(request.session.logined == true){
    var html = readHTML('add-novel')
  }
  else{
    var html = readHTML('main') + '<script>alert("이어쓰기 임시저장 불러오기는 로그인 후 이용 가능합니다."); location.replace("/")</script>'
  }
  if(request.params.num == 'getback'){
    html = changeElements(html, [{'key': 'text-input', 'value': request.session['tempSaveAddValue' + request.params.id].text}, {'key': 'subject', 'value': request.params.subject}])
  }
  else{
    var filePath = './users/' + request.session.user_id + '/novels/' + request.params.id + '.json'
    var tempSaveArr = JSON.parse(fs.readFileSync(filePath))
  
    if(request.params.num != -1){
      html = changeElements(html, [{'key': 'title-input', 'value': tempSaveArr[request.params.num].title}, {'key': 'text-input', 'value': tempSaveArr[request.params.num].text}, {'key': 'subject', 'value': request.params.subject}])
    }
    else{
      html = changeElements(html, [{'key': 'title-input', 'value': ''}, {'key': 'text-input', 'value': ''}, {'key': 'subject', 'value': request.params.subject}])
    }
  }

  novelFilePath = './novels/' + request.params.subject + '/' + request.params['id'] + '.json'
  var novelFile = JSON.parse(fs.readFileSync(novelFilePath)) //파일 열기
  var novelText = '...' + toHTMLText(novelFile.paragraph[novelFile.paragraph.length - 1].history[novelFile.paragraph[novelFile.paragraph.length - 1].history.length - 1].text)
  var novelTitle = novelFile.title
  html = changeElements(html, [{'key': 'novel-id', 'value': request.params.id},
  {'key': 'novel-title', 'value': novelTitle}, {'key': 'novel-text', 'value': novelText}, {'key': 'subject', 'value': request.params.subject}])
  response.send(topNavAddHTML(html, request))
});


//채팅 서비스 이용
app.get('/chat', function(request, response) {
    var html = readHTML('chat') + `<script>var myname = '${request.session.logined ? request.session.user_id : '익명'}'</script>`
    response.send(html)
});


//회원가입
app.post("/signup", function(req,res,next){
  var body = req.body;
  var salt = makeSalt()
  var pw = makeHash(body.password, salt)
  var newUser = {
    id: body.id,
    pw: pw,
    salt: salt
  }
  if(!saveUser(newUser)){
    res.send(readHTML('login') + '<script>alert("같은 사용자가 있습니다. 다른 닉네임으로 다시 시도해 주세요.")</script>')
  }
  else{
    req.session.user_id = body.id
    req.session.logined = true
    console.log(req.session.user_id)
    res.redirect('/');
  }
})

//로그인
app.post("/login", function(req,res,next){
  var body = req.body;
  var userOBJ = openUser(body.id)
  if(!userOBJ){
    res.send(readHTML('login') + '<script>alert("가입되지 않은 사용자입니다. 회원가입을 먼저 진행해 주세요.")</script>')
  }
  else{
    var salt = userOBJ.salt
    var pw = makeHash(body.password, salt)
    if(pw == userOBJ.pw){
      req.session.user_id = userOBJ.id
      req.session.logined = true
      res.redirect('/');
    }
    else{
      res.send(readHTML('login') + '<script>alert("비밀번호가 틀렸습니다. 다시 입력해 주세요.")</script>')
    }
  }
})

//등록
app.post("/novel/:subject/new", function(request,res,next){
  //변수입수
  var body = request.body;
  var title = body.novelTitle;
  var text = body.novelText;
  //현재 소설 개수
  nowNum = fs.readdirSync('./novels/' + request.params.subject).length

  //파일경로 
  var filePath = './novels/' + request.params.subject + '/' + nowNum + '.json'
  //새 소설 json
  var saveObj = {
    id: nowNum,
    title: title,
    author: request.session.user_id,
    time: + new Date(),
    paragraph: [
      {
        author: request.session.user_id,
        time: + new Date(),
        history: [
          {
            text: text,
            time: + new Date(),
          }
        ]
      }
    ]
  }

  

  if(!fs.existsSync(filePath)){
    fs.writeFileSync(filePath, JSON.stringify(saveObj))
  }
  res.redirect('/subject' + request.params.subject);
})

//이어쓰기 등록
app.post("/novel/:subject/view/add/:id", function(request,res,next){
  //변수입수
  var body = request.body;
  var text = body.novelText;
  //현재 소설 개수
  nowNum = fs.readdirSync('./novels/' + request.params.subject).length

  var filePath = './novels/'+ request.params.subject + '/' + request.params.id + '.json'
  var tempSaveArr = JSON.parse(fs.readFileSync(filePath))

  //새 paragraph JSON
  var Paragraph = 
    {
      author: request.session.user_id,
      time: + new Date(),
      history: [
        {
          text: text,
          time: + new Date(),
        }
      ]
    }
  
  tempSaveArr.paragraph[tempSaveArr.paragraph.length] = Paragraph
  tempSaveArr.time = + new Date()

  console.log(tempSaveArr)
  console.log(filePath)
  fs.writeFileSync(filePath, JSON.stringify(tempSaveArr))
  res.redirect('/novel/' + request.params.subject + '/view/' + request.params.id);
})

//임시 저장
app.post("/novel/save", function(req,res,next){
  var body = req.body;
  var title = body.novelTitle;
  var text = body.novelText;
  console.log(title + '\n' + text)
})

//소켓 통신
io.on('connection', (socket) => {
  socket.on('topCATRreq-choice', (data)=>{
    //사용자 기록 저장하기
    saveReview(data.userName, data.wrongAnswers)
    saveChoiceRecord(data.userName, data.CATR)
    saveChoiceRank(data.userName, data.CATR)
    if(data.isReview == true){
      setReview(data.userName, data.wrongAnswers)
    }

    //다시 보내주기
    socket.emit('topCATRres-choice', {
      topCATR: getChoiceRank(0).CATR,
      topCATRuser: getChoiceRank(0).user_id
    })
  })

  socket.on('topCATRreq-question', (data)=>{
    //사용자 기록 저장하기
    saveReviewQ(data.userName, data.wrongAnswers)
    saveQuestionRecord(data.userName, data.CATR)
    saveQuestionRank(data.userName, data.CATR)
    if(data.isReview == true){
      setReviewQ(data.userName, data.wrongAnswers)
    }

    //다시 보내주기
    socket.emit('topCATRres-question', {
      topCATR: getQuestionRank(0).CATR,
      topCATRuser: getQuestionRank(0).user_id
    })
  })

  console.log('connected!')
  var chatRoomName = '광장'

  //최근 채팅내용 전송
  now100 = Math.floor(chatCount(chatRoomName) / 100)
  if(chatCount(chatRoomName) % 100 == 0){
    now100-=1
  }
  socket.emit('chatList', {
    nowchat100: now100,
    chatList:chatRead('광장', now100)
  })

  socket.on('chat', (data)=>{
    var msgData = {
      nickname: removeTag(data.nickname),
      msg: removeTag(data.msg),
      id: chatCount(chatRoomName)
    }
    io.emit('newchat', msgData)
    console.log(msgData.nickname + ": " + msgData.msg)

    //데이터 저장하기
    chatSave(chatRoomName, msgData)
  })

  socket.on('chatListReq', (data)=>{
    socket.emit('chatListRes', chatRead(chatRoomName, data))
  })

  socket.on('name-cookie', (data) =>{ //닉네임 쿠키 저장
    //socket.cookie('nickname', data)
  })

  socket.on('save', (data)=>{ //임시저장
    var filePath = './users/' + socket.request.session.user_id + '/tempSave.json'
    var saveObj = {
      title: data.title,
      text: data.text,
      time: + new Date()
    }

    if(!fs.existsSync(filePath)){
      fs.writeFileSync(filePath, JSON.stringify([saveObj]))
    }
    else{
      var arr = JSON.parse(fs.readFileSync(filePath))
      arr[arr.length] = saveObj
      fs.writeFileSync(filePath, JSON.stringify(arr))
    }
  })

  socket.on('add-save', (data)=>{ //임시저장
    var dirPath = './users/' + socket.request.session.user_id + '/novels'
    if(!fs.existsSync(dirPath)){
      fs.mkdirSync(dirPath)
    }

    var filePath = './users/' + socket.request.session.user_id + '/novels/' + data.id + '.json'
    
    var saveObj = {
      text: data.text,
      time: + new Date()
    }

    if(!fs.existsSync(filePath)){
      fs.writeFileSync(filePath, JSON.stringify([saveObj]))
    }
    else{
      var arr = JSON.parse(fs.readFileSync(filePath))
      arr[arr.length] = saveObj
      fs.writeFileSync(filePath, JSON.stringify(arr))
    }
  })

  var nickname = socket.handshake.headers.cookie
  console.log(nickname)
})

//css 라우팅
app.get('/css/:name', function(request, response) {
  response.send(fs.readFileSync('css/' + request.params.name))
});

//js 라우팅
app.get('/js/:name', function(request, response) {
  response.send(fs.readFileSync('js/' + request.params.name))
});

//폰트 라우팅
server.listen(8080, function() {
  console.log('Example app listening on port 3000!')
});
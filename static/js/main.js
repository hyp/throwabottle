//app globals
var netCount = 0;
var bottleCount = 0;

//counters + notifications]
function setNetCount(n){
    netCount = n;
    if(n>0){
        $('#btn_net_counter').html(n.toString()).css('display','block');
    }else
        $('#btn_net_counter').css('display','none');
}
function setBottleCount(n){
    bottleCount = n;
    if(n>0){
        $('#btn_bottle_counter').html(n.toString()).css('display','block');
    }else
        $('#btn_bottle_counter').css('display','none');
}


if(mobile){
    //iPhone Scale Bug Fix, read this when using http://www.blog.highub.com/mobile-2/a-fix-for-iphone-viewport-scale-bug/
    MBP.scaleFix();
    MBP.hideUrlBar();
    //MBP.preventZoom();
}

var ids=0;

$(document).ajaxError(function(event, request, settings){
    alert("Error requesting page " + settings.url);
});

//base popup
function Popup(title,content){
    this.id='_'+ids;ids++;
    if((typeof content) === 'string')
        $('body').append('<div class="fullscreen popup" id="'+this.id+'"><h3>'+title+'</h3>' + content +'</div>');
}

Popup.prototype.transition = function(other){
    this.close();
    other.show();
    return this;
}

//scrollable
ScrollablePopup.prototype = new Popup;
ScrollablePopup.prototype.constructor = Popup;


ScrollablePopup.native = mobile ? false : true;
ScrollablePopup.iscroll = !ScrollablePopup.native;

function ScrollablePopup(title,body,innerBody){
    innerBody = innerBody ? innerBody : '';
    this.id='_'+ids;ids++;
    this.scrollbar = null;

    var src = '<div class="fullscreen popup" id="'+this.id+'"><h3>'+title+'</h3>'+
        '<div class="popup-contentRaised popup-background">'+
        '<div class="'+(innerBody === '' ?'popup-content-scrollable':'popup-content-scrollableRaised')+'" id="scroll'+this.id+'"><ul id="data'+this.id+'"></ul></div>'+
        innerBody+'</div>'+body+'</div>';

    $('body').append(src);
}

ScrollablePopup.prototype.current = null;

//IE8 no opacity support
if ( $.browser.msie && $.browser.version < 9) {
    Popup.prototype.show = function(){
        $('#'+this.id).css('display','block');
    }
    Popup.prototype.close = function(){
        $('#'+this.id).css('display','none');
    }
    ScrollablePopup.prototype.show = function(){
        if(ScrollablePopup.prototype.current) return;
        ScrollablePopup.prototype.current = this;
        $('#'+this.id).css('display','block');
        var id = this.id;
        if(ScrollablePopup.native)
            $('#scroll'+this.id).css('overflow','auto');
        else if(ScrollablePopup.iscroll) this.scrollbar = new iScroll('scroll'+this.id,{hScroll:false,hScrollbar:false});
        return this;
    }
    ScrollablePopup.prototype.close = function(){
        var scrollbar = this.scrollbar;
        $('#'+this.id).css('display','none');
        if(scrollbar){
            try{
                scrollbar.destroy();
            }
            catch(exp){
            }
        }
        this.scrollbar = null;
        ScrollablePopup.prototype.current = null;
        return this;
    }
}else{
    Popup.prototype.show = function(){
        $('#'+this.id).fadeIn('slow');
        return this;
    }
    Popup.prototype.close = function(){
        $('#'+this.id).fadeOut('slow');
        return this;
    }
    ScrollablePopup.prototype.show = function(){
        if(ScrollablePopup.prototype.current) return;
        ScrollablePopup.prototype.current = this;
        $('#'+this.id).fadeIn('slow');
        var id = this.id;
        if(ScrollablePopup.native)
            $('#scroll'+this.id).css('overflow','auto');
        else if(ScrollablePopup.iscroll) this.scrollbar = new iScroll('scroll'+this.id,{hScroll:false,hScrollbar:false});
        return this;
    }
    ScrollablePopup.prototype.close = function(){
        var scrollbar = this.scrollbar;
        $('#'+this.id).fadeOut('slow',function(){
            if(scrollbar){
                try{
                    scrollbar.destroy();
                }
                catch(exp){
                }
            }
        });
        this.scrollbar = null;
        ScrollablePopup.prototype.current = null;
        return this;
    }
}


ScrollablePopup.prototype.transition = function(other){
    this.close();
    other.show();
}
ScrollablePopup.prototype.update= function(data){
    var id = 0;
    var idPrefix=this.id+'_';

    var src = '';
    for(var i=0;i < data.length;i++){
        src += this.nodeCreator(data[i],idPrefix+id);
        id++;
    }
    $('#data'+this.id).html(src);

    id = 0;
    var handler = this.childClick;
    if(handler) for(var i=0;i < data.length;i++){
        $('#'+idPrefix+id).data('id',id).click(function(){
            handler($(this).data('id'));
        });
        id++;
    }
}
ScrollablePopup.prototype.child = function(id) {
    return $('#'+this.id+'_'+id);
}

if(ScrollablePopup.native){
    ScrollablePopup.prototype.refresh = function(){ };
    ScrollablePopup.prototype.scrollToBottom = function(){
        var dh=$('#data'+this.id).height();
        var ch=$('#scroll'+this.id).height();
        if(dh>ch) $('#scroll'+this.id).scrollTop(dh-ch);
    };
}
else if(ScrollablePopup.iscroll){
    //IE crashes on adding listener
    if(!$.browser.msie) document.addEventListener('touchmove', function (e) { e.preventDefault(); }, false);
    ScrollablePopup.prototype.refresh = function(){ this.scrollbar.refresh(); };
    ScrollablePopup.prototype.scrollToBottom = function(){
        var dh=$('#data'+this.id).height();
        var ch=$('#scroll'+this.id).height();
        if(dh>ch) this.scrollbar.scrollTo(0,-(dh-ch),0);
    }
}


function postTextarea(url,node,handler){
    if(handler) $.post(url, node.serialize() ,handler,'json');
    else $.post(url, node.serialize() ,handler,'json');
    node.val('');
}

//TODO new frame
//views
var welcome = new Popup('Welcome','<div class="popup-content popup-background">' +
    '<p>What is message in a bottle? It is a simple service which allows you to throw anonymous bottles into the sea.</p>' +
    '<button type="button" class="centeredButton" onClick="welcome.transition(signin);">Sign in</button>' +
    '<button type="button" class="centeredButton" onClick="welcome.transition(registration);">Register</button>' +
    '<button type="button" class="centeredButton" id="facebook_signin"><img src="images/fbConnect.png" alt="" id="facebook_signin_icon"/>Connect</button></div>');

var signin = new Popup('Log In','<div class="popup-content popup-background"><form id="loginForm">' +
    '<label for="userid">User ID:</label>' +
    '<input type="text" id="loginUser" name="userid" required autocapitalize="off"/>' +
    '<label for="password">Password:</label>'+
    '<input type="password" id="loginPassword" name="password" required autocapitalize="off"/>' +
    '<input type="submit" style="float:none;margin:20px auto" value="Log in"/></form></div>');

var registration = new Popup('Register','<div class="popup-content popup-background"><form id="registrationForm">' +
    '<label for="userid">User ID:</label>' +
    '<input type="text" id="regUser" name="userid" required autocapitalize="off"/>' +
    '<label for="password">Password:</label>'+
    '<input type="password" id="regPassword" name="password" required autocapitalize="off"/>' +
    '<label for="password">Confirm password:</label>'+
    '<input type="password" id="regPasswordConfirm" name="password" required autocapitalize="off"/>'+
    '<input type="submit" style="float:none;margin:20px auto" value="Register"/></form></div>');

var newBottle = new Popup('Say something:','<form id="newBottleForm"><div class="popup-contentRaised popup-background">'+
    '<div class="popup-content-bordered"><div class="textareaWrapper"><textarea name="m" id="newBottleText" maxlength="500" required></textarea></div></div></div>' +
    '<div class="popup-footer"><input type="button" value="Back" onClick="newBottle.close();"/>'+
    '<input type="submit" value="Throw"/></div></form>');

var caughtBottle = new Popup('Bottle caught:',
    '<div class="popup-contentRaised popup-background"><div class="popup-content-scrollableRecievedBottle" id="scroll_'+ids+'">'+
        '<div id="data_'+ids+'"></div></div>'+
        '<div class="message-reply"><div class="textareaWrapper"><textarea name="m" maxlength="500" id="replyToBottle" placeholder="Reply.."></textarea></div></div></div>'+
        '<div class="popup-footer"><button type="button" onClick="caughtBottle.close();$.get(\'api/bottle/recycle\');">Throw back</button><button type="button" id="replyToBottleSubmit">Reply</button></div>');
caughtBottle.show = ScrollablePopup.prototype.show;
caughtBottle.close = ScrollablePopup.prototype.close;


var threads = new ScrollablePopup('Messages','<div class="popup-footer"><button type="button" style="float:none;margin:10px auto" onClick="threads.close();">Ok</button></div>');

threads.childClick = function(id){
    //alert('t:'+id);
    var thread = threads.child(id).append('<div class="threadLoader"></div>');
    var recieved = false;
    function messagesRecieved(data){
        if(recieved) return;
        recieved = true;
        $('.threadLoader').remove();
        if(data.r && data.r.length !== 0){
            if(threads.threads[id].e !==0 ){
                threads.child(id).removeClass('threadNotRead').addClass('threadRead');
                notifications.count(_notifications - threads.threads[id].e);
            }
            messages.threadId = threads.threads[id].i;
            messages.messages = data.r;
            messages.update(data.r);
            threads.transition(messages);
            setTimeout(function(){ messages.scrollToBottom() },500);
        }
    }

    setTimeout(function(){ messagesRecieved({r:[{s:0,m:'Hi there!'},{s:1,m:'Hi yourself'},{s:0,m:'Hi oo<br>jshjls'},{s:1,m:'F.U'},{s:0,m:'Pop pop!'}]}); },2000);
    $.get('api/messages?i='+threads.threads[id].i,messagesRecieved,'json');
}
threads.nodeCreator = function(thread,id){
    return '<li class="thread '+(thread.e==0?'threadRead':'threadNotRead')+'" id="'+id+'">'+(thread.s==1?'<div class="threadArrowHead"></div><div class="threadArrow"></div>':'')+'<span>'+thread.m+'</span></li>';
}

var messages = new ScrollablePopup('Messages','<div class="popup-footer"><button type="button" onClick="messages.transition(threads);">Back</button><button type="button" id="replyToMessageSubmit" onClick="messages.showReply();">Reply</button></div>',
    '<div class="message-reply"><div class="textareaWrapper"><textarea name="m" maxlength="500" id="replyToMessage" placeholder="Reply.."></textarea></div></div>');

messages.nodeCreator = function(message,id){
    return '<li><div class="message '+(message.s==1?'message-sender':'message-reciever')+'"><p>'+message.m.replace(/\n/g,'<br/>')+'</p></div></li>';
}
messages.showReply = function() {
    $.post('api/reply?i='+messages.threadId, $('#replyToMessage').serialize());
    reply = $('#replyToMessage').val().replace(/\n/g,'<br/>');
    messages.messages.push({s:1,m:reply});
    messages.update(messages.messages);
    messages.refresh();
    messages.scrollToBottom();
    $('#replyToMessage').val('');
}

//Show when you've caught some junk
function animatedImagePopup(src){
    $('#fishCaught').css('display','block').animate({width:"256px",height:"256px","margin-left":"-128px","margin-top":"-128px"},500,'linear',function(){
        setTimeout("$('#fishCaught').fadeOut(function(){$('#fishCaught').css({'width':'0',height:'0','margin-left':'0','margin-top':'0'});})",600);
    });
}

$('#facebook_signin').click(function(){
    window.location.href = 'https://www.facebook.com/dialog/oauth/?client_id=233473013410744&display='+(mobile ? 'touch' : 'page')+'&redirect_uri=http%3A%2F%2F199.30.59.142%2Fapi%2Ffblogin&response_type=code';
});

$('#newBottleForm').submit(function(){
    setBottleCount(bottleCount-1);
    postTextarea('api/throw',$('#newBottleText'));
    newBottle.close();
    return false;
});

$('#replyToBottleSubmit').click(function(){
    postTextarea('api/bottle/reply',$('#replyToBottle'));
    caughtBottle.close();
});

$('#loginForm').submit(function(){
    var userid = $('#loginUser').val();
    var password = $('#loginPassword').val();
    $.post('api/login','userid='+userid+'&pwd='+password,function(response){
        if(response.r === 0){
            handleQuery(response);
            signin.close();
        }
        else alert('Wrong username or password!');
    },'json');
    return false;
});

$('#registrationForm').submit(function(){
    var userid = $('#regUser').val();
    var password = $('#regPassword').val();
    if(password != $('#regPasswordConfirm').val()){
        alert("The passwords don't match!\nPlease try again.");
        $('#regPassword').val('');
        $('#regPasswordConfirm').val('');
        return false;
    }
    $.post('api/register','userid='+userid+'&pwd='+password,function(response){
        if(response.r === 0){
            handleQuery(response);
            registration.close();
        }
        else alert('This username is already taken!');
    },'json');
    return false;
});

$('#btn_bottle').click(function(){
    if(bottleCount === 0) alert('No more bottles remaining!');
    else newBottle.show();
});

$('#btn_net').click(function(){
    if(mobile){
        animatedImagePopup();
        return;
    }
    function bottleCaught(data){
        if(data.r >= 0){
            if(data.m){
                $('#data'+caughtBottle.id).html('<p>'+data.m.replace(/\n/g,'<br/>')+'</p>');
                caughtBottle.show();
            }else {
                animatedImagePopup();
            }
        }
    }

    if(netCount === 0) alert('No more nets remaining!');
    else{
        setNetCount(netCount - 1);
        $.get('api/catch',bottleCaught,'json');
    }
});


var notifications = $('#notifications');
var _notifications = 0;
notifications.count = function(n){
    _notifications = n;
    if(n > 0){
        this.html(n.toString());
        this.css('display','block');
    }else this.css('display','none');
}

$('#btn_history').click(function(){
    var recieved = false;
    function threadsRecieved(data){
        if(recieved) return;
        recieved = true;
        if(data.r && data.r.length !== 0){
            threads.threads = data.r;
            threads.update(data.r);
            threads.show();
        }
    }
    $.get('api/threads',threadsRecieved,'json');

    setTimeout(function(){ threadsRecieved({r:[{i:1,s:0,e:1,m:'foo'},{i:2,s:1,e:1,m:'bar'},{i:3,s:0,e:0,m:'kR%H H JR%\n5uytrjhgr rggh\nrgjhr rjghj5hjg 5jhghj\n5uytrjhgr rggh rgjhr rjghj5hjg 5jhghj'},{i:4,s:1,e:1,m:'lol'},{i:5,s:0,e:0,m:'test'},{i:6,s:1,e:1,m:'lol'},{i:7,s:0,e:0,m:'test'}]}); },
        2000);
});

function handleQuery(response){
    if(response.r === 0){
        setBottleCount(response.b);
        setNetCount(response.n);
        notifications.count(response.e ? response.e : 0);
    }
    else welcome.show();
}

//poll the server for updates
var isActive = true;
window.onfocus = function () {
    isActive = true;
}
window.onblur = function () {
    isActive = false;
}
function query(){
    if(isActive){
        $.get('api/query',handleQuery);
    }
    setTimeout(query,5 * 60 * 1000);
}

function enableBackgroundAnimations(){
    $('.cloud').addClass('cloudAnimated');
    $('.cloudFast').addClass('cloudFastAnimated');
    $('.cloudSlow').addClass('cloudSlowAnimated');
}
function disableBackgroundAnimations(){
    $('.cloudAnimated').removeClass('cloudAnimated');
    $('.cloudFastAnimated').removeClass('cloudFastAnimated');
    $('.cloudSlowAnimated').removeClass('cloudSlowAnimated');
}

$(document).ready(function(){
    query();
    //handleQuery({r:0,b:6,n:4,e:2});
    if(!mobile) enableBackgroundAnimations();
});
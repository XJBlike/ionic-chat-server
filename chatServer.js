var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');

app.get('/', function(req, res){
	res.send('<h1>Welcome Realtime Server</h1>');
});

//在线用户列表
var onlineUsers = [];

var sqlConnection = mysql.createConnection({
	host:"localhost",
	port:"3306",
	user:"root",
	password:"",
	database:"chat",
	charset : 'UTF8_GENERAL_CI',
	debug : false
});
sqlConnection.connect();

var findSocket = function(id){
	for(var i = 0;i < onlineUsers.length;i++){
		if(onlineUsers[i].id == id){
			return onlineUsers[i];
		}
	}
	return {};
};

var deleteSocket = function(id){
	for(var i = 0;i < onlineUsers.length;i++){
		if(onlineUsers[i].id == id){
			onlineUsers.splice(i,1);
			return true;
		}
	}
	return false;
};

io.on('connection', function(socket){
	console.log('a user connected');


	//监听新用户加入
	socket.on('login', function(obj){
		var currentUser = {
            id: obj.userId,
			socket:socket
		};
		socket.id=obj.userId;
		//将新加入用户的唯一标识当作socket的名称，后面退出的时候会用到
		//socket.id = obj.userId;
		//console.log(socket);
		var loginSql = 'select * from userInfo where id=\''
			+ obj.userId
		    + '\' and password=\''
			+ obj.password
		    + '\';';
		sqlConnection.query(loginSql, function(err, rows) {
			if (err) {
				throw err;
			}else{
				if(rows.length > 0){
					onlineUsers.push(currentUser);
					currentUser.socket.emit("login:success",{userInfo: rows[0]});
					console.log(rows[0].id+"("+rows[0].nickname+")登录成功")
				}
				else{
					currentUser.socket.emit("login:fail",{err: "用户名或密码错误!"});
					currentUser = {};
				}
			}
		});
	});

	socket.on('changeImg',function(data){
		var updateSql = "update userInfo set img = "
		    +data.userInfo.img
			+" where id=\'"
			+data.userInfo.id
		    +"\';";
		sqlConnection.query(updateSql,function(err){
			if(err){
				throw err;
				console.log("更新头像失败");
			}else{
				console.log("更新头像成功");
			}
		});
	});

	socket.on('changeDesc',function(data){
		var updateSql = "update userInfo set description = \'"
			+data.userInfo.description
			+"\' where id=\'"
			+data.userInfo.id
			+"\';";
		sqlConnection.query(updateSql,function(err){
			if(err){
				throw err;
				console.log("更新签名失败");
			}else{
				console.log("更新签名成功");
			}
		});
	});

	socket.on("changeNickname",function(data){
		var updateSql = "update userInfo set nickname = \'"
			+data.userInfo.nickname
			+"\' where id=\'"
			+data.userInfo.id
			+"\';";
			sqlConnection.query(updateSql,function(err){
				if(err){
					throw err;
					console.log("更新昵称失败");
				}else{
					console.log("更新昵称成功");
				}
			});
	}
	);
	socket.on("changeLocation",function(data){
			var updateSql = "update userInfo set location = \'"
				+data.userInfo.location
				+"\' where id=\'"
				+data.userInfo.id
				+"\';";
			sqlConnection.query(updateSql,function(err){
				if(err){
					throw err;
					console.log("更新地区失败");
				}else{
					console.log("更新地区成功");
				}
			});
		}
	);

	socket.on("changeSex",function(data){
			var updateSql = "update userInfo set sex = \'"
				+data.userInfo.sex
				+"\' where id=\'"
				+data.userInfo.id
				+"\';";
			sqlConnection.query(updateSql,function(err){
				if(err){
					throw err;
					console.log("更新性别失败");
				}else{
					console.log("更新性别成功");
				}
			});
		}
	);


	//监听用户退出
	socket.on('logout', function(data){
		   if(deleteSocket(data.userInfo.id)){
			   console.log(data.userInfo.id+"("+data.userInfo.nickname+")退出成功");
		}else{
			   console.log(data.userInfo.id+"("+data.userInfo.nickname+")退出失败");
		   }
	});

	socket.on('friends',function(data){
		var friendsSql = "SELECT id,nickname,description,sex,location,location,img,backname"
		      +" from userinfo,friends "
		      +" where userinfo.id = friends.friendId and friends.userId = \'"
		      +data.id
			  +"\'";
		var currentUser = {
			id: data.id,
			socket:socket
		};
		sqlConnection.query(friendsSql,function(err,rows){
			if(err){
				throw err;
			}
			else{
				if(rows.length){
					currentUser.socket.emit("friends:success",{friends:rows});
				}
				else{
					currentUser.socket.emit("friends:success",{friends:[]});
				}
			}
		});
	});

	socket.on("searchFriends",function(data){
		var currentUser = {
			id: data.id,
			socket:socket
		};
		var searchFriendsSql = "select id,nickname,description,sex,location,img,backname from userinfo,friends where id = friendId and userId = \'"
			+data.userId+"\' and ("
			+"friendId LIKE \'"
			+ "%"+data.keyword+"%\' or backname LIKE \'"
			+ "%"+data.keyword+"%\' or nickname LIKE \'"
			+ "%"+data.keyword+"%\')";
		var searchUsersSql = "select id,nickname,description,sex,location,img from userInfo where id <> \'"+data.userId+"\' and (id LIKE \'"
			+ "%"+data.keyword+"%\' or nickname LIKE \'"
			+ "%"+data.keyword+"%\') and id NOT in(select friendId from friends where userId = \'"
			+data.userId
			+"\')";
		sqlConnection.query(searchFriendsSql,function(err,rows){
			if(err){
				throw err;
			}else{
				currentUser.socket.emit("searchFriends:success",{friends:rows});
			}
		});
		sqlConnection.query(searchUsersSql,function(err,rows){
			if(err){
				throw err;
			}else{
				currentUser.socket.emit("searchUsers:success",{users:rows});
			}
		});
	});

	socket.on('friendInfo',function(data){
		var friendInfoSql = "select id,nickname,description,img,sex,location,backname from userinfo,friends where id=friendId and "
			+ "friendId = \'"
			+ data.friendId
			+ "\' and userId = \'"
			+data.userId
			+ "\'";
		var currentUser = {
			id:data.userId,
			socket:socket
		};
		sqlConnection.query(friendInfoSql,function(err,rows){
			if(err){
				throw err;
			}else{
				if(rows.length>0){
					currentUser.socket.emit("friendInfo:success",{friendInfo:rows[0]});
				}
			}
		});
	});
   //修改好友备注名
	socket.on("backnameChange",function(data){
		var friend = data.friend;
		var userId = data.userId;
		var updateBacknameSql = "update friends set backname = \'" +
			friend.backname+"\' where userId=\'" +
			userId+"\' and friendId = \'" +
			friend.id+"\'";
		console.log(updateBacknameSql);
		sqlConnection.query(updateBacknameSql,function(err,rows){
			if(err){
				throw err;
			}else{
				console.log("用户"+userId+"已将"+friend.id+"的备注修改为"+friend.backname);
			}
		});
	});
    //删除好友
	socket.on('remove:friend',function(data){
		var friend = data.friend;
		var userId = data.userId;
		var deleteFriendSql = "delete from friends where (userId=\'"
			+userId+"\' and friendId=\'"
			+friend.id
			+"\') or (userId=\'"
			+friend.id
			+"\' and friendId =\'"
			+userId+"\')";
		sqlConnection.query(deleteFriendSql,function(err,rows){
			if(err){
				throw err;
			}else{
				console.log("用户"+userId+"与用户"+friend.id+"解除好友关系");
			}
		});
	});

	socket.on("add:friend",function(data){
		var friendId = data.friendId;
		var userId = data.userId;
		var backname = data.backname;
		var message = data.message;
		var addFriendSql = "insert into friends values(\'" +userId+
			"\',\'" +friendId+
			"\',\'" +backname+
			"\'),(\'" +friendId+
			"\',\'" +userId+
			"\',\'" +message+
			"\')";
		console.log(addFriendSql);
		sqlConnection.query(addFriendSql,function(err,rows){
			if(err){
				throw err;
			}else{
				console.log("用户"+userId+"与用户"+friendId+"成为好友！");
			}
		});
	});
	//监听用户发布聊天内容
	socket.on('message', function(obj){
		//向所有客户端广播发布的消息
		io.emit('message', obj);
		console.log(obj.username+'说：'+obj.content);
	});
  
});

http.listen(9000,function(){
	console.log("chat server running on port 9000");
});
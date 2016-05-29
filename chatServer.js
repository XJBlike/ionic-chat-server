var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var fs = require('fs');
var url = require('url');

var writeRecord = function(filename,str){
	fs.appendFile(filename,str,function(err){
		if(err){
			console.log("失败");
		}
	})
};

app.get('/records/*.txt', function(req, res){
	var filename = url.parse(req.url).pathname;
	var str = fs.readFileSync("G:\\github\\ionic-chat-server\\"+filename,'utf-8');
	res.send(str);
});

var onlineUsers = {};

var messageStruct = {
	"id": null,
	"backname": null,
	"nickname": null,
	"img": null,
	"lastMessage": {},
	"noReadMessages": 0,
	"showHints": true,
	"isTop": 0,
	"showMessage":true,
	"messages": []
};

var isMessageInArray = function(arr,message){
	for(var i=0;i<arr.length;i++){
		if(arr[i].content == message && message.time == arr[i].time){
			return true;
		}
	}
	return false;
};

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


io.on('connection', function(socket){
	console.log('a user connected');


	//监听新用户加入
	socket.on('login', function(obj){
		if(onlineUsers[obj.userId]){
			socket.emit("login:fail",{err:"不能重复登录！"});
		}else{
			onlineUsers[obj.userId] = socket;
			socket.id = obj.userId;
			var currentUser = {
				id: obj.userId,
				socket:socket
			};
			console.log("登录，刚登陆的用户socket为："+onlineUsers[currentUser.id].toString());
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
						currentUser.socket.emit("login:success",{userInfo: rows[0]});
						console.log(rows[0].id+"("+rows[0].nickname+")登录成功")
					}
					else{
						currentUser.socket.emit("login:fail",{err: "用户名或密码错误!"});
						currentUser = {};
					}
				}
			});
		}
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
		   if(onlineUsers[data.userInfo.id]){
			   console.log(data.userInfo.id+"("+data.userInfo.nickname+")退出成功,删去socket:"+onlineUsers[data.userInfo.id]);
			   delete onlineUsers[data.userInfo.id];
		}else{
			   console.log(data.userInfo.id+"("+data.userInfo.nickname+")退出失败,无其socket");
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
		var friendInfoSql = "select id,nickname,description,img,sex,location,backname from userinfo,friends where id=friendId"
			+ " and userId = \'"
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
				currentUser.socket.emit("friendInfo:success",{friendInfo:rows});
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
		sqlConnection.query(addFriendSql,function(err,rows){
			if(err){
				throw err;
			}else{
				console.log("用户"+userId+"与用户"+friendId+"成为好友！");
			}
		});
	});
    socket.on("users",function(data){
		var currentUser ={
			id:data.userId,
            socket:socket
		};
		var usersSql = "select id from userInfo";
		sqlConnection.query(usersSql,function(err,rows){
			if(err){
				throw err;
			}else{
				currentUser.socket.emit("users:success",{users:rows});
			}
		});
	});
	socket.on("register",function(data){
		var newUserSql = "insert into userInfo values(\'"
			+data.user.id+ "\',\'" + data.user.nickname+ "\',\'" + data.user.password+"\',\'"+data.user.description+"\',\'"+data.user.sex+"\',\'"+data.user.location+"\',"+data.user.img+")";
		//var newMessageTableSql = "create table message_"+data.user.id+" (friendId varchar(10) PRIMARY KEY not NULL,record MEDIUMTEXT NOT NULL)";
		var currentUser ={
			id:data.user.id,
			socket:socket
		};
		sqlConnection.query(newUserSql,function(err,rows){
			if(err){
				throw err;
			}else{
				console.log("新用户"+data.user.id+"注册成功");
			}
		});
		//sqlConnection.query(newMessageTableSql,function(err,rows){
		//	if(err){
		//		throw err;
		//	}else{
		//		console.log("新用户"+data.user.id+"的聊天记录表建立成功");
		//	}
		//});
		currentUser.socket.emit('register:success',{info:"注册成功,自动登录！"});
	});

	//socket.on("messages:getAll",function(data){
	//	var userId = data.userId;
	//	var currentUser = {
	//		id:userId,
	//		socket:socket
	//	};
	//	var messageRecordSql = "select record from message_"+userId;
	//	sqlConnection.query(messageRecordSql,function(err,rows){
	//		if(err){
	//			throw err;
	//		}else{
	//			if(rows.length){
	//				currentUser.socket.emit("messages:getAllSuccess",{messages:rows});
	//			}
	//			else{
	//				console.log("暂无聊天记录");
	//				currentUser.socket.emit("messages:getAllSuccess",{messages:[]});
	//			}
	//		}
	//	});
	//});

	//监听用户发布聊天内容
	socket.on('message:send', function(data){
          var userId = data.userId;
		  var friendId = data.friendId;
		  var message = data.currentMessage;
		  var friendSocket = onlineUsers[friendId];
		  message.isFromMe = false;
		  if(friendSocket){
			  friendSocket.emit("message:receive",{friendId:userId,message:message});
		  }else{
			  var offlineMsgSql = "insert into offlineMessages values('"+userId+"','"+friendId+"','"+JSON.stringify(message)+"','"+Date.now()+"')";
			  sqlConnection.query(offlineMsgSql,function(err,rows){
				  if(err){
					  throw err;
				  }else{
					  console.log(userId+"给"+friendId+"发送的离线消息已经存储！");
				  }
			  });
		  }
		  //else{
			//  sqlConnection.query("select record from message_"+friendId+" where friendId='"+userId+"'",function(err,rows){
			//	  if(err){
			//		  throw err;
			//	  }else{
			//		  if(rows.length){
			//			  var record = rows[0].record;
			//			  if(!isMessageInArray(record.messages,message)){
			//				  record.messages.push(message);
			//				  record.lastMessage = message;
			//				  record.noReadMessages ++;
			//				  record.showHints= true;
			//				  sqlConnection.query("update message_"+friendId+" set record='"+JSON.stringify(record)+"' where friendId='"+userId+"'",function(err,rows){
			//					  if(err){
			//						  throw err;
			//					  }else{
			//						  console.log("离线用户"+friendId+"的聊天记录表已经更新");
			//					  }
			//				  });
			//			  }
			//		  }
			//		  else{
			//			  sqlConnection.query(selectFriendInfo,function(err,rows){
			//				  if(err){
			//					  throw err;
			//				  }else{
			//					  msgStruct.img=rows[0].img;
			//					  msgStruct.nickname=rows[0].nickname;
			//					  msgStruct.backname=rows[0].backname;
			//					  msgStruct.id=rows[0].id;
			//					  if(!isMessageInArray(msgStruct.messages,message)){
			//						  msgStruct.messages.push(message);
			//						  msgStruct.lastMessage = message;
			//						  msgStruct.noReadMessages++;
			//						  sqlConnection.query("update message_"+friendId+" set record='"+JSON.stringify(msgStruct)+"' where friendId='"+userId+"'",function(err,rows){
			//							  if(err){
			//								  throw err;
			//							  }else{
			//								  console.log("离线用户"+friendId+"的聊天记录已经建立并更新");
			//							  }
			//						  });
			//					  }
			//				  }
			//			  })
			//		  }
			//	  }
			//  });
          //
		  //}
	});

	socket.on("getOfflineMsg",function(data){
		var userId = data.userId;
		var offlineSql = "select fromUser,message from offlineMessages where toUser='"+userId+"' order by time";
		var deleteSql = "delete from offlineMessages where toUser='"+userId+"'";
        sqlConnection.query(offlineSql,function(err,rows){
			if(err){
				throw err;
			}else{
				if(rows.length){
					socket.emit("getOfflineMsg:success",{rows:rows});
					sqlConnection.query(deleteSql,function(err,rows){
						if(err){
							throw err;
						}else{
							console.log("离线消息更新成功！");
						}
					})
				}
			}
		})
	});

	//socket.on("updateRecord",function(data){
	//	var record = data.record;
	//	var userId = data.userId;
	//	var friendId = data.friendId;
	//	var recordExist = data.recordExist;
	//	var updateRecordSql = "update message_"+userId+" set record = '"+JSON.stringify(record)+"' where friendId='"+friendId+"'";
     //   var insertRecordSql = "insert into message_"+userId+" values('"+friendId+"','"+JSON.stringify(record)+"')";
	//	var updateSql = recordExist?updateRecordSql:insertRecordSql;
	//	sqlConnection.query(updateSql,function(err,rows){
	//		if(err){
	//			throw err;
	//		}else if(rows.length){
	//			console.log(userId+"的聊天记录表已经更新");
	//		}
	//	});
	//});

	//socket.on("deleteMessage",function(data){
	//	var userId = data.userId;
	//	var friendId = data.friendId;
	//	var deleteMessageSql = "delete from message_"+userId+" where friendId='"+friendId+"'";
	//	sqlConnection.query(deleteMessageSql,function(err,rows){
	//		if(err){
	//			throw err;
	//		}
	//	});
	//});

	//socket.on("message:receiveSuccess",function(data){
	//	var userId = data.userId;
	//	var friendId = data.friendId;
	//	var record = data.record;
	//	var recordExist = data.recordExist;
		//var updateRecordSql = "update message_"+userId+" set record='"+JSON.stringify(record)+"' where friendId='"+friendId+"'";
		//var insertRecordSql = "insert into message_"+userId+" values('"+friendId+"','"+JSON.stringify(record)+"')";
		//var updateSql = recordExist?updateRecordSql:insertRecordSql;
		//sqlConnection.query(updateSql,function(err,rows){
		//	if(err){
		//		throw err;
		//	}else{
		//		console.log(userId+"的聊天记录表已经更新");
		//	}
		//});
	//});

	socket.on("downloadRecord",function(data){
		var user = data.user;
		var friendName = data.backname;
		var fileName = "records/USER"+user.id+"("+data.friendId+").txt";
        var messages = data.messages;
		var str = "";
		fs.writeFile(fileName,"",function(err){
			if(err){
				console.log("失败："+err);
			}else{
				console.log("成功创建文件!");
			}
		});
		for(var i=0;i<messages.length;i++){
			  if(messages[i].isFromMe){
				  str = messages[i].screenTime+" "+user.nickname+"说: "+messages[i].content+"\r\n";
				  writeRecord(fileName,str);
			  }else{
				  str = messages[i].screenTime+" "+friendName+"说: "+messages[i].content+"\r\n";
				  writeRecord(fileName,str);
			  }
		}
	});

	socket.on("modifyPassword",function(data){
		var userId = data.userId;
		var newPwd = data.newPwd;
		var updatePwdSql = "update userInfo set password = '"+newPwd+"' where id='"+userId+"'";
		sqlConnection.query(updatePwdSql,function(err,rows){
			if(err){
				console.log("修改密码失败！");
			}else{
				console.log("用户"+userId+"修改密码成功！");
				socket.emit("modifyPassword:success",{info:"修改密码成功！"});
			}
		});
	});
  
});

http.listen(9000,function(){
	console.log("chat server running on port 9000");
});
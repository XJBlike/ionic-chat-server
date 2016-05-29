var fs = require('fs');

fs.appendFile("records/text.txt","嘿嘿",function(err){
	if(err){
		console.log("fail"+err);
	}else{
		console.log("成功");
	}
});
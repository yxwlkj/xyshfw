import 'package:flutter/material.dart';
import '../../services/socket_service.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';

class ChatPage extends StatefulWidget {
  final int targetUid;
  final String targetName;
  final String targetAvatar;
  final String chatType;
  final String? groupId;

  const ChatPage({
    super.key,
    required this.targetUid,
    required this.targetName,
    required this.targetAvatar,
    this.chatType = 'p2p',
    this.groupId,
  });

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<dynamic> _messages = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
    if (widget.chatType == 'p2p') {
      SocketService.onP2pMessage = _onMessageReceived;
    } else {
      SocketService.onGroupMessage = _onMessageReceived;
      if (widget.groupId != null) {
        SocketService.joinGroup(widget.groupId!);
      }
    }
  }

  void _onMessageReceived(Map data) {
    setState(() {
      _messages.add({
        'from_uid': data['fromUid'],
        'content': data['content'],
        'type': data['type'] ?? 'text',
        'create_time': DateTime.now().toIso8601String(),
      });
    });
    _scrollToBottom();
  }

  Future<void> _loadHistory() async {
    try {
      final targetId = widget.chatType == 'p2p' ? widget.targetUid : widget.groupId;
      final history = await ApiService.getChatHistory(widget.chatType, targetId);
      setState(() {
        _messages = history;
        _isLoading = false;
      });
      _scrollToBottom();
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _sendMessage() {
    final content = _controller.text.trim();
    if (content.isEmpty) return;

    if (widget.chatType == 'p2p') {
      SocketService.sendP2pMessage(widget.targetUid, content);
    } else if (widget.groupId != null) {
      SocketService.sendGroupMessage(widget.groupId!, content);
    }

    setState(() {
      _messages.add({
        'from_uid': AuthService.uid,
        'content': content,
        'type': 'text',
        'create_time': DateTime.now().toIso8601String(),
      });
    });
    _controller.clear();
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.targetName),
        actions: [
          IconButton(
            icon: const Icon(Icons.call),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.videocam),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final isMe = msg['from_uid'] == AuthService.uid;
                      return _buildMessageBubble(msg, isMe);
                    },
                  ),
          ),
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Map msg, bool isMe) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isMe)
            CircleAvatar(
              backgroundImage: NetworkImage(widget.targetAvatar.isNotEmpty 
                  ? widget.targetAvatar 
                  : 'https://picsum.photos/200'),
              radius: 20,
            ),
          if (!isMe) const SizedBox(width: 8),
          Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.6),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isMe ? const Color(0xFF07C160) : Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 2),
              ],
            ),
            child: Text(
              msg['content'] ?? '',
              style: TextStyle(color: isMe ? Colors.white : Colors.black87),
            ),
          ),
          if (isMe) const SizedBox(width: 8),
          if (isMe)
            CircleAvatar(
              backgroundImage: NetworkImage(AuthService.userInfo?['avatar'] ?? 'https://picsum.photos/200'),
              radius: 20,
            ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade300)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.add, color: Colors.grey),
            onPressed: () {},
          ),
          Expanded(
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: '发送消息',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: Colors.grey.shade100,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              ),
              maxLines: null,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.send, color: Color(0xFF07C160)),
            onPressed: _sendMessage,
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    if (widget.chatType == 'p2p') {
      SocketService.onP2pMessage = null;
    } else {
      SocketService.onGroupMessage = null;
    }
    super.dispose();
  }
}
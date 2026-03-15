import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import 'chat/chat_page.dart';

class ChatListPage extends StatefulWidget {
  const ChatListPage({super.key});

  @override
  State<ChatListPage> createState() => _ChatListPageState();
}

class _ChatListPageState extends State<ChatListPage> {
  List<dynamic> _sessions = [];
  Map<int, Map<String, dynamic>> _usersCache = {};

  @override
  void initState() {
    super.initState();
    _loadSessions();
    SocketService.onP2pMessage = _onNewMessage;
  }

  void _onNewMessage(Map data) {
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    try {
      final sessions = await ApiService.getChatSessions();
      setState(() {
        _sessions = sessions;
      });
    } catch (e) {
      print('加载会话失败: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('消息', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
        ],
      ),
      body: ListView.builder(
        itemCount: _sessions.length,
        itemBuilder: (context, index) {
          final session = _sessions[index];
          final user = session['user'] ?? {};
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: NetworkImage(user['avatar'] ?? 'https://picsum.photos/200'),
              radius: 24,
            ),
            title: Text(user['nickname'] ?? '未知'),
            subtitle: Text(
              session['content'] ?? '',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.grey),
            ),
            trailing: Text(
              _formatTime(session['create_time']),
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ChatPage(
                    targetUid: user['id'],
                    targetName: user['nickname'] ?? '未知',
                    targetAvatar: user['avatar'] ?? '',
                    chatType: 'p2p',
                  ),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: const Color(0xFF07C160),
        child: const Icon(Icons.add),
      ),
    );
  }

  String _formatTime(String? time) {
    if (time == null) return '';
    try {
      final dt = DateTime.parse(time);
      final now = DateTime.now();
      if (dt.day == now.day) {
        return '${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
      }
      return '${dt.month}/${dt.day}';
    } catch (e) {
      return '';
    }
  }
}
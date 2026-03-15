import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';

class CreateGroupPage extends StatefulWidget {
  const CreateGroupPage({super.key});

  @override
  State<CreateGroupPage> createState() => _CreateGroupPageState();
}

class _CreateGroupPageState extends State<CreateGroupPage> {
  List<dynamic> _friends = [];
  final Set<int> _selectedFriends = {};
  final TextEditingController _groupNameCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  Future<void> _loadFriends() async {
    final friends = await ApiService.getFollows();
    setState(() => _friends = friends);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('创建群聊'),
        actions: [
          TextButton(
            onPressed: _selectedFriends.isEmpty ? null : _createGroup,
            child: Text('创建(${_selectedFriends.length})'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _groupNameCtrl,
              decoration: const InputDecoration(
                hintText: '输入群名称',
                prefixIcon: Icon(Icons.group),
                border: OutlineInputBorder(),
              ),
            ),
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('选择好友', style: TextStyle(color: Colors.grey)),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _friends.length,
              itemBuilder: (context, index) {
                final friend = _friends[index];
                final isSelected = _selectedFriends.contains(friend['id']);
                return ListTile(
                  leading: CircleAvatar(
                    backgroundImage: NetworkImage(friend['avatar'] ?? 'https://picsum.photos/200'),
                  ),
                  title: Text(friend['nickname'] ?? '未知'),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle, color: Color(0xFF07C160))
                      : const Icon(Icons.circle_outlined, color: Colors.grey),
                  onTap: () {
                    setState(() {
                      if (isSelected) {
                        _selectedFriends.remove(friend['id']);
                      } else {
                        _selectedFriends.add(friend['id']);
                      }
                    });
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _createGroup() {
    if (_groupNameCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请输入群名称')));
      return;
    }

    SocketService.createGroup(_groupNameCtrl.text, _selectedFriends.toList());
    
    // 监听创建成功事件
    SocketService.onP2pMessage = null;
    // 显示成功提示
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('群聊创建成功')));
    Navigator.pop(context);
  }

  @override
  void dispose() {
    _groupNameCtrl.dispose();
    super.dispose();
  }
}
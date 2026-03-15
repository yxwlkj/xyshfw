import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../chat/chat_page.dart';
import 'create_group_page.dart';

class ContactsPage extends StatefulWidget {
  const ContactsPage({super.key});

  @override
  State<ContactsPage> createState() => _ContactsPageState();
}

class _ContactsPageState extends State<ContactsPage> {
  List<dynamic> _follows = [];
  List<dynamic> _myGroups = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final follows = await ApiService.getFollows();
      final groups = await ApiService.getMyGroups();
      setState(() {
        _follows = follows;
        _myGroups = groups;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('通讯录', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            onPressed: () => _showSearchDialog(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                _buildSection('我的群聊', _myGroups.map((g) => {
                  'id': g['id'],
                  'name': g['name'],
                  'avatar': '',
                  'isGroup': true,
                }).toList()),
                const Divider(height: 1),
                _buildSection('好友', _follows),
              ],
            ),
    );
  }

  Widget _buildSection(String title, List<dynamic> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            title,
            style: const TextStyle(color: Colors.grey, fontSize: 14),
          ),
        ),
        ...items.map((item) {
          final isGroup = item['isGroup'] ?? false;
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: item['avatar'].isNotEmpty
                  ? NetworkImage(item['avatar'])
                  : const NetworkImage('https://picsum.photos/200'),
              radius: 20,
            ),
            title: Text(item['nickname'] ?? item['name'] ?? '未知'),
            onTap: () {
              if (isGroup) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ChatPage(
                      targetUid: 0,
                      targetName: item['name'] ?? '群聊',
                      targetAvatar: '',
                      chatType: 'group',
                      groupId: item['id'],
                    ),
                  ),
                );
              } else {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ChatPage(
                      targetUid: item['id'],
                      targetName: item['nickname'] ?? '未知',
                      targetAvatar: item['avatar'] ?? '',
                    ),
                  ),
                );
              }
            },
          );
        }),
      ],
    );
  }

  void _showSearchDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('添加好友'),
        content: TextField(
          decoration: const InputDecoration(hintText: '输入用户名或昵称'),
          onSubmitted: (keyword) async {
            final users = await ApiService.searchUsers(keyword);
            if (!mounted) return;
            Navigator.pop(context);
            if (users.isNotEmpty) {
              _showUserInfo(users[0]);
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('未找到用户')),
              );
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
        ],
      ),
    );
  }

  void _showUserInfo(Map user) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 40,
              backgroundImage: NetworkImage(user['avatar'] ?? 'https://picsum.photos/200'),
            ),
            const SizedBox(height: 16),
            Text(user['nickname'] ?? '未知', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton.icon(
                  onPressed: () {
                    ApiService.followUser(user['id']);
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.person_add),
                  label: const Text('关注'),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF07C160)),
                ),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChatPage(
                          targetUid: user['id'],
                          targetName: user['nickname'] ?? '未知',
                          targetAvatar: user['avatar'] ?? '',
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.chat),
                  label: const Text('聊天'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
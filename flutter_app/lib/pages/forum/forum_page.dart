import 'package:flutter/material.dart';

class ForumPage extends StatefulWidget {
  const ForumPage({super.key});

  @override
  State<ForumPage> createState() => _ForumPageState();
}

class _ForumPageState extends State<ForumPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<Map<String, dynamic>> _categories = [
    {'id': 1, 'name': '全部'},
    {'id': 2, 'name': '二手交易'},
    {'id': 3, 'name': '失物招领'},
    {'id': 4, 'name': '租房信息'},
    {'id': 5, 'name': '学习交流'},
    {'id': 6, 'name': '兼职招聘'},
  ];

  final List<Map<String, dynamic>> _posts = [
    {'id': 1, 'title': '出二手电动车', 'content': '毕业转让爱车，9成新，可小刀', 'author': '小明', 'category': '二手交易', 'time': '2小时前', 'likes': 12, 'comments': 5},
    {'id': 2, 'title': '捡到校园卡一张', 'content': '今天在图书馆捡到校园卡，联系电话138xxxx', 'author': '小红', 'category': '失物招领', 'time': '3小时前', 'likes': 8, 'comments': 2},
    {'id': 3, 'title': '出租单间', 'content': '校内单间出租，空调热水器齐全', 'author': '房东张', 'category': '租房信息', 'time': '5小时前', 'likes': 20, 'comments': 10},
    {'id': 4, 'title': '考研资料分享', 'content': '22年考研成功上岸，分享资料', 'author': '上岸学姐', 'category': '学习交流', 'time': '1天前', 'likes': 56, 'comments': 28},
    {'id': 5, 'title': '招聘家教', 'content': '招小学数学家教，时薪50元', 'author': '家长李', 'category': '兼职招聘', 'time': '1天前', 'likes': 15, 'comments': 8},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _categories.length, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('校园论坛'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: _categories.map((c) => Tab(text: c['name'])).toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: _categories.map((c) => _buildPostList(c['id'])).toList(),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showPublishDialog,
        backgroundColor: const Color(0xFF07C160),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildPostList(int categoryId) {
    final posts = categoryId == 1 ? _posts : _posts.where((p) => p['category'] == _categories[categoryId - 1]['name']).toList();
    
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: posts.length,
      itemBuilder: (context, index) {
        final post = posts[index];
        return _buildPostCard(post);
      },
    );
  }

  Widget _buildPostCard(Map post) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF07C160).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    post['category'],
                    style: const TextStyle(color: Color(0xFF07C160), fontSize: 12),
                  ),
                ),
                const Spacer(),
                Text(post['time'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 8),
            Text(post['title'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(post['content'], maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.person, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text(post['author'], style: const TextStyle(color: Colors.grey, fontSize: 12)),
                const Spacer(),
                const Icon(Icons.thumb_up, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text('${post['likes']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(width: 16),
                const Icon(Icons.comment, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text('${post['comments']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showPublishDialog() {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    int selectedCategory = 2;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 16,
            right: 16,
            top: 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('发布帖子', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                value: selectedCategory,
                decoration: const InputDecoration(labelText: '分类', border: OutlineInputBorder()),
                items: _categories.where((c) => c['id'] > 1).map((c) => DropdownMenuItem(
                  value: c['id'],
                  child: Text(c['name']),
                )).toList(),
                onChanged: (v) => setState(() => selectedCategory = v ?? 2),
              ),
              const SizedBox(height: 12),
              TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: '标题', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: contentCtrl, maxLines: 4, decoration: const InputDecoration(labelText: '内容', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    if (titleCtrl.text.isEmpty || contentCtrl.text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请填写完整')));
                      return;
                    }
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('发布成功')));
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF07C160)),
                  child: const Text('发布', style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
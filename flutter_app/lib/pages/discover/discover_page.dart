import 'package:flutter/material.dart';
import 'run/run_orders_page.dart';
import 'forum/forum_page.dart';
import 'moments/moments_page.dart';

class DiscoverPage extends StatelessWidget {
  const DiscoverPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('发现', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        children: [
          _buildSection([
            _buildItem(Icons.circle, '朋友圈', onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const MomentsPage()));
            }),
          ]),
          _buildSection([
            _buildItem(Icons.local_shipping, '校园跑腿', onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const RunOrdersPage()));
            }),
            _buildItem(Icons.fastfood, '内外卖', onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const RunOrdersPage(type: 'food')));
            }),
          ]),
          _buildSection([
            _buildItem(Icons.forum, '校园论坛', onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ForumPage()));
            }),
            _buildItem(Icons.article, '帖子', onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ForumPage()));
            }),
          ]),
          _buildSection([
            _buildItem(Icons.near_me, '附近的人', onTap: () {}),
            _buildItem(Icons.people, '摇一摇', onTap: () {}),
          ]),
          _buildSection([
            _buildItem(Icons.gamepad, '游戏', onTap: () {}),
          ]),
        ],
      ),
    );
  }

  Widget _buildSection(List<Widget> items) {
    return Column(
      children: [
        ...items,
        const Divider(height: 1, indent: 56),
      ],
    );
  }

  Widget _buildItem(IconData icon, String title, {VoidCallback? onTap}) {
    return ListTile(
      leading: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: const Color(0xFF07C160),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      onTap: onTap,
    );
  }
}
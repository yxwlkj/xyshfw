import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';

class RunOrdersPage extends StatefulWidget {
  final String? type;
  
  const RunOrdersPage({super.key, this.type});

  @override
  State<RunOrdersPage> createState() => _RunOrdersPageState();
}

class _RunOrdersPageState extends State<RunOrdersPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _allOrders = [];
  List<dynamic> _myOrders = [];
  bool _isLoading = true;
  String _orderType = '';

  @override
  void initState() {
    super.initState();
    _orderType = widget.type ?? '';
    _tabController = TabController(length: 2, vsync: this);
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    try {
      final allOrders = await ApiService.getRunOrders();
      final myOrders = await ApiService.getRunOrders(my: 'true');
      setState(() {
        _allOrders = allOrders;
        _myOrders = myOrders;
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
        title: Text(_orderType == 'food' ? '内外卖' : '校园跑腿'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: '接单大厅'),
            Tab(text: '我的订单'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildOrdersList(_allOrders),
          _buildOrdersList(_myOrders),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showPublishDialog,
        backgroundColor: const Color(0xFF07C160),
        icon: const Icon(Icons.add),
        label: const Text('发布订单'),
      ),
    );
  }

  Widget _buildOrdersList(List<dynamic> orders) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text('暂无订单', style: TextStyle(color: Colors.grey[600])),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return _buildOrderCard(order);
        },
      ),
    );
  }

  Widget _buildOrderCard(Map order) {
    final status = order['status'] ?? 0;
    final isMyOrder = order['uid'] == AuthService.uid;
    final statusText = ['待接单', '进行中', '已完成'];
    final statusColor = [Colors.orange, Colors.blue, Colors.green];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _orderType == 'food' ? Icons.fastfood : Icons.local_shipping,
                  color: const Color(0xFF07C160),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    order['title'] ?? '',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor[status],
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    statusText[status],
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(order['detail'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Expanded(child: Text(order['address'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 12))),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '¥${(order['fee'] ?? 0).toStringAsFixed(2)}',
                  style: const TextStyle(color: Colors.red, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                if (status == 0 && !isMyOrder)
                  ElevatedButton(
                    onPressed: () => _takeOrder(order['id']),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF07C160)),
                    child: const Text('接单'),
                  )
                else if (status == 1 && order['runner_uid'] == AuthService.uid)
                  ElevatedButton(
                    onPressed: () => _finishOrder(order['id']),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                    child: const Text('完成'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showPublishDialog() {
    final titleCtrl = TextEditingController();
    final detailCtrl = TextEditingController();
    final feeCtrl = TextEditingController();
    final addressCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('发布订单', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: '标题', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: detailCtrl, maxLines: 3, decoration: const InputDecoration(labelText: '详情', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: feeCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '费用(元)', prefixText: '¥ ', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: '地址', prefixIcon: Icon(Icons.location_on), border: OutlineInputBorder())),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    if (titleCtrl.text.isEmpty || feeCtrl.text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请填写完整信息')));
                      return;
                    }
                    final success = await ApiService.publishRunOrder(
                      titleCtrl.text,
                      detailCtrl.text,
                      double.tryParse(feeCtrl.text) ?? 0,
                      addressCtrl.text,
                    );
                    if (mounted) {
                      Navigator.pop(context);
                      if (success) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('发布成功')));
                        _loadOrders();
                      }
                    }
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

  Future<void> _takeOrder(int orderId) async {
    final success = await ApiService.takeOrder(orderId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success ? '接单成功' : '接单失败')));
      if (success) _loadOrders();
    }
  }

  Future<void> _finishOrder(int orderId) async {
    final success = await ApiService.finishOrder(orderId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success ? '订单已完成，费用已结算' : '操作失败')));
      if (success) _loadOrders();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
---
title: 早停法（Early Stopping）
publish: true
updated: 2026-07-17T07:30:36.032Z
---

# 早停法（Early Stopping）

> 出自《神经网络与深度学习》第三章

---

## 原题

![题目](学习笔记/ai/nndl/image/ch03_early_stopping_exercise.png)

---

## 1. 什么是早停法

在验证集准确率不再提升时提前终止训练，避免过拟合。

```
准确率
  │
  │              训练准确率
  │            ╱─────────────
  │          ╱
  │        ╱     ← 训练还在涨
  │      ╱
  │    ╱          验证准确率
  │  ╱          ╱────●  ← 早停点 (第 n 轮没提升)
  │╱          ╱    │
  │         ╱      │ 过了这里验证开始下降 = 过拟合
  │       ╱        ↓
  │     ╱
  └────────────────────── epoch
```

---

## 2. 策略一：n 回合不提升终止

### 原理

跟踪验证集准确率，如果连续 n 个 epoch 没有刷新最佳记录，就停止训练。

### 代码实现

修改 `network2.py` 的 `SGD` 方法：

```python
def SGD(self, training_data, epochs, mini_batch_size, eta,
        lmbda=0.0,
        evaluation_data=None,
        monitor_evaluation_cost=False,
        monitor_evaluation_accuracy=False,
        monitor_training_cost=False,
        monitor_training_accuracy=False,
        early_stopping_n=0):          # ★ 新增：连续 n 轮不提升则停止，0 表示不启用
    """使用小批量随机梯度下降训练神经网络。

    新增参数:
        early_stopping_n: 早停轮数。如果连续 n 轮验证准确率没有提升，
                          则提前终止训练。设为 0 表示不启用早停。
    """

    best_accuracy = 0         # 历史最佳验证准确率
    best_epoch = 0            # 最佳准确率出现的 epoch
    no_improvement_count = 0 # 连续未提升的计数器

    # ... 其余初始化代码不变 ...

    for j in range(epochs):
        # ... 训练和监控代码不变 ...

        # ★ 早停判断：在每轮评估准确率之后检查
        if evaluation_data:
            current_accuracy = self.accuracy(evaluation_data)

            if current_accuracy > best_accuracy:
                # 刷新最佳记录
                best_accuracy = current_accuracy
                best_epoch = j
                no_improvement_count = 0  # 重置计数器
            else:
                no_improvement_count += 1

            # 如果连续 early_stopping_n 轮没有提升，提前终止
            if early_stopping_n > 0 and \
               no_improvement_count >= early_stopping_n:
                print("早停: 连续 {} 轮未提升，最佳准确率 {} 出现在 epoch {}".format(
                    early_stopping_n, best_accuracy, best_epoch))
                break

    # ... 返回语句不变 ...
```

### 使用方式

```python
net.SGD(training_data, 100, 10, 0.5,         # epochs 设大一点，让早停决定何时停
        lmbda=0.5,
        evaluation_data=validation_data,
        monitor_evaluation_accuracy=True,
        early_stopping_n=10)                  # 连续 10 轮不提升就停
```

---

## 3. 策略二：验证代价上升终止

### 原理

策略一看的是**准确率**，但准确率是离散的（10000 个样本，1 个样本 = 0.01%），可能很多轮都不变。

策略二看**验证代价**（连续值），更灵敏：当代价开始上升时，说明开始过拟合。

```
验证代价
  │
  │  ●
  │    ●
  │      ●
  │        ●
  │          ●     ← 最低点
  │            ●╲
  │              ╲ ●  ← 代价开始上升 = 过拟合
  │               │ ●
  │               │   ●
  └───────────────┼────────── epoch
              最佳点  停止点
```

### 代码实现

```python
# 在 SGD 中增加另一种早停逻辑
if early_stopping_n > 0 and evaluation_data:
    current_cost = self.total_cost(evaluation_data, lmbda, convert=True)

    if current_cost < best_cost:
        best_cost = current_cost
        best_epoch = j
        no_improvement_count = 0
    else:
        no_improvement_count += 1

    if no_improvement_count >= early_stopping_n:
        print("早停: 验证代价连续 {} 轮未下降".format(early_stopping_n))
        break
```

### 两种策略对比

| | 策略一：准确率不提升 | 策略二：代价上升 |
|---|---|---|
| 监控指标 | 验证准确率（离散） | 验证代价（连续） |
| 灵敏度 | 低（0.01% 粒度） | 高（小数级变化） |
| 噪声抗性 | 高（准确率波动小） | 低（代价可能波动） |
| 适用场景 | MNIST 等分类任务 | 回归或需要精细监控的任务 |

---

## 4. 策略三：学习率衰减 + 准确率平台终止

### 原理

当准确率进入平台期时，降低学习率做精细搜索；如果降学习率后仍然不提升，才终止。

```
学习率
  │ ●━ 0.5
  │      ╲
  │       ╲━ 0.05  ← 准确率停滞时降低 10 倍
  │             ╲
  │              ╲━ 0.005  ← 降了还不行，再降
  │                    ╲
  │                     ╲━━ 停止
  └─────────────────────────── epoch
```

### 代码实现

```python
if early_stopping_n > 0 and evaluation_data:
    current_accuracy = self.accuracy(evaluation_data)

    if current_accuracy > best_accuracy:
        best_accuracy = current_accuracy
        best_epoch = j
        no_improvement_count = 0
    else:
        no_improvement_count += 1
        # 准确率停滞时降低学习率
        if no_improvement_count == early_stopping_n // 2:
            eta = eta / 10
            print("学习率降至 {}".format(eta))

    if no_improvement_count >= early_stopping_n:
        print("早停: 连续 {} 轮未提升".format(early_stopping_n))
        break
```

### 三种策略对比

| 策略 | 优点 | 缺点 |
|---|---|---|
| n 轮准确率不提升 | 简单、稳定 | 灵敏度低，可能晚停 |
| 验证代价上升 | 灵敏度高 | 容易被噪声误导 |
| 学习率衰减 + 平台终止 | 兼顾灵敏度和稳定性 | 需要调更多参数 |

---

## 5. 总结

早停法是最简单有效的正则化方法：

- **不需要修改网络结构**，只改训练循环
- **不需要修改代价函数**，只加一个判断
- **自动找到最佳停止点**，不用猜训练多少轮
- 相当于一种隐式正则化：限制训练时间 = 限制模型复杂度

实践建议：先用策略一（n=10），简单可靠，足以应对大多数场景。

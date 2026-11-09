---
title: lec10 Program Optimization
publish: true
updated: 2026-10-27T12:12:22.418Z
---

1. Generally Useful Optimizations
	- Code Motion（代码移动）：Especially moving code out of loop![1258](<Attachments/Pasted image 20261027123638.png>)
	- Reduction in Strength（强度削弱）：Replace costly operation with simpler one，Shift, add instead of multiply or divide![1260](<Attachments/Pasted image 20261027123619.png>)
	- Share Common Subexpressions（共享公共子表达式）：![1264](<Attachments/Pasted image 20261027124739.png>)
2. bad example
    - blocker#1：Procedure Calls
	    - ![806](<Attachments/Pasted image 20261027125759.png>)
	    - N calls to strlen，Overall O($N^2$) performance
	    - 为什么编译器不能将strlen移出内层循环
		    - 程序调用是黑盒，链接前不能确定strlen的功能
		    - 循环中可能对 s 做了修改，不能确定每次strlen(s)是否相同
		- 正确的修改
			- ![](<Attachments/Pasted image 20261027183035.png>)
	- blocker#2：Memory Matter
		- ![](<Attachments/Pasted image 20261027133510.png>)
		- 内层循环每次都会访存 $b[i]$ 
		- 为什么编译器不用一个寄存器保存 $b[i]$ 
			- 内存必须假设B是A的内存别名，A和B可能重叠（下面这段代码有错误，应为double \*B = A + 3）
			- ![305](<Attachments/Pasted image 20261027183109.png>)
		- 正确的修改：养成引入局部变量的习惯，防止内存别名
			- ![](<Attachments/Pasted image 20261027183210.png>)
3. benchmark
	- 优化前
		- ![](<Attachments/Pasted image 20261027185023.png>)
	- 基本优化
		- ![](<Attachments/Pasted image 20261027185239.png>)
	- 优化后：速度提升20倍
		- ![](<Attachments/Pasted image 20261027185313.png>)
		- 为什么combine4的4个时间是1：3：3：5？
4. Pipeline
	- 指令的latency和cycles
		- ![](<Attachments/Pasted image 20261027190536.png>)
			- Latency：一条指令所需要的总时钟周期数
			- cycles/issue：连续发射两条**同类指令**所需要间隔的时钟周期数，用于衡量吞吐量
			- 除法指令不能流水线
	- 上一个benchmark的1：3：3：5的根本原因：每次循环执行乘法/加法都要等待上次循环的结果
		- ![](<Attachments/Pasted image 20261027190852.png>)
	- 循环展开
		- case1
			- ![](<Attachments/Pasted image 20261027193207.png>)
			- ![](<Attachments/Pasted image 20261027193234.png>)
			- 依然存在顺序依赖，性能未改变（整数加法的改变说明改善的是循环的开销，而非整数加法的开销）
		- case2
			- ![](<Attachments/Pasted image 20261027193417.png>)
			- ![](<Attachments/Pasted image 20261027193438.png>) ![](<Attachments/Pasted image 20261027193559.png>)
			- 下一次循环中的操作可以提前开始，加速比接近2倍
			- 整数加法（ALU）和浮点乘法的硬件有2套，可以一次load进去，所以吞吐bound是0.5。另外两种的吞吐只有一套硬件。
		- case3
			- ![](<Attachments/Pasted image 20261027193657.png>)
			- ![](<Attachments/Pasted image 20261027194012.png>) ![659](<Attachments/Pasted image 20261027193840.png>)
			- 奇偶分组，加速比为2
		- case4
			- 可以展开到任意程度，L个元素分为K组，接近理论上限
			- ![597](<Attachments/Pasted image 20261027194135.png>)
	- SIMD
		- 使用大寄存器和SIMD可以进一步提速
			- ![545](<Attachments/Pasted image 20261027194909.png>) ![](<Attachments/Pasted image 20261027200021.png>) 
	- 分支预测
		- 预测失败怎么办
			1. 执行单元对比条件判断的“真实结果”和“预测结果”，发现不一致
			2. 流水线冲刷（Pipeline Flush）：立刻停止取指，正在排队的错误指令直接被清空
			3. 状态回滚（State Rollback）：**检查点恢复（Checkpoint）**：现代 CPU 会在预测分支前，给当前的寄存器映射表“拍个快照”。发现错了直接把快照覆盖回去。
			4. 重新取指 -> 解码 -> 执行
5. Getting High Performance
	1. 仔细检查最内层循环（大部分工作在此完成）
	2. 利用指令级并行
	3. 避免不可预测的分支
	4. 使代码对高速缓存友好
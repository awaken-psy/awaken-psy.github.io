---
title: lec14 Exceptional Control Flow - Exceptions and Processes
publish: true
updated: 2026-11-09T02:16:15.728Z
---


## 第 1 页｜Exceptional Control Flow——异常与进程

> 异常控制流，异常与进程。
>
> 15-213，计算机系统导论。
>
> 第 14 讲，2015 年 10 月 15 日。
>
> 授课教师为 Randal E. Bryant 和 David R. O’Hallaron。

本讲研究系统事件如何让 CPU 转入内核，以及操作系统如何在进程之间切换、创建进程、等待子进程和装入新程序。

## 第 2 页｜Today——本讲安排

> 异常控制流。
>
> 异常。
>
> 进程。
>
> 进程控制。

课件首先讨论底层的用户态与内核态控制转移，再建立进程抽象，最后用 fork、exit、wait、waitpid、execve 分析程序行为。

## 第 3 页｜Control Flow——控制流

> 从启动到关闭，CPU 读取并执行指令序列。
>
> 这条指令执行序列称为控制流，也称 flow of control。

图沿时间方向画出 inst1、inst2、inst3……直到关闭。这里使用单个逻辑处理器的架构指令流视角。

流水线、乱序执行等机制可以重叠处理多条指令，程序仍然有需要遵守的架构执行语义。下面研究的是执行位置怎样从一段程序转入另一段程序。

## 第 4 页｜Altering the Control Flow——改变执行位置

> 已经学过的跳转、分支、调用与返回，会根据程序状态改变控制流。
>
> 系统还需要响应系统状态变化，例如磁盘或网络数据到达、执行除零指令、用户输入 Ctrl-C、定时器到期。
>
> 因此需要异常控制流机制。

普通分支由程序指令决定，设备完成等事件则可能发生在程序执行的任意阶段。操作系统需要取得执行机会，处理设备、调度任务或处理访问错误。

## 第 5 页｜Exceptional Control Flow——异常控制流的层次

> 异常控制流存在于计算机系统的多个层次。

| 机制 | 原文含义 | 主要实现者 |
|---|---|---|
| Exceptions | 响应系统事件而转移控制 | 硬件与操作系统 |
| Context switch | 切换进程执行上下文 | 操作系统与硬件支持 |
| Signals | 向进程传递事件通知 | 操作系统 |
| setjmp、longjmp | 保存并恢复某个执行环境，进行非局部跳转 | C 运行库 |

这几种机制处于不同层次。设备中断可以让 CPU 进入内核，内核处理后可能继续当前进程，也可能调度其他进程。

## 第 6 页｜Today——进入异常机制

> 异常控制流、异常、进程、进程控制。

当前强调“异常”。后面先看处理入口与返回位置，再讨论进程。

## 第 7 页｜Exceptions——异常

![第7页用户代码与异常处理](Attachments/lec14-ecf-procs/page-07.png)

> 异常是响应事件而把控制交给操作系统内核的一种转移。
>
> 内核是操作系统驻留内存的核心部分。
>
> 示例事件包括除零、算术溢出、缺页、I/O 请求完成以及输入 Ctrl-C。

图中 I_current 表示当前指令，I_next 表示后继指令。进入异常处理程序后，可能有三种结果。

1. 返回当前指令，重新执行。
2. 返回后继指令，继续前进。
3. 结束发生问题的程序。

返回位置由异常类别和处理结果决定。这也是后面区分 trap、fault、abort 的一个重要依据。

## 第 8 页｜Exception Tables——异常表

![第8页异常编号与处理入口](Attachments/lec14-ecf-procs/page-08.png)

> 每一类事件有一个异常编号 k。
>
> k 用作异常表的索引，异常表也称中断向量表。
>
> 对应事件发生时，转入相应处理程序。

本页画出编号 0、1、2……对应不同处理入口。CPU 根据事件类型与体系结构规则，取得入口并进行控制转移。

x86 使用中断描述符表等结构描述相应入口。后面的“系统调用号”则用于进入系统调用路径后选择具体服务，两个编号承担各自的分发职责。

## 第 9 页｜Asynchronous Exceptions——异步异常与中断

> 由处理器外部事件触发。
>
> 通过硬件中断请求等机制通知处理器。
>
> 处理后返回下一条待执行的指令，原页称为 next instruction。

课件的例子包括定时器中断，以及键盘、网络、磁盘等设备的 I/O 事件。

定时器可以周期性触发中断，让内核取得执行机会，处理时间相关工作和调度。图中采用每隔几毫秒一次的示例。

终端中的 Ctrl-C 还涉及更高层处理。输入事件到达内核后，终端机制可以向前台进程组发送 SIGINT。设备中断与发送给进程的信号，分别处于硬件事件处理和进程通知层。

## 第 10 页｜Synchronous Exceptions——同步异常

> 同步异常由执行当前指令引起。

| 类别 | 原文描述 | 处理后的典型行为 |
|---|---|---|
| Trap，陷阱 | 有意触发，例如系统调用、断点、特殊指令 | 从后继指令继续 |
| Fault，故障 | 意外触发但可能恢复。原页列出缺页、保护异常、浮点异常 | 修复后重试当前指令，或结束程序 |
| Abort，终止类异常 | 原页描述为意外且不可恢复，列出非法指令、奇偶校验错误、机器检查 | 原页描述为终止当前程序 |

课件把 illegal instruction 列在 abort 的例子中。按 x86 的体系结构分类，非法操作码异常 #UD 属于 fault，保存的指令位置指向出错指令。操作系统可以通过 SIGILL 等处理结束用户程序。[Intel 异常分类说明](https://www.intel.com/content/dam/support/us/en/documents/processors/pentium4/sb/25366821.pdf)

因此，体系结构的异常类别与操作系统最终采用的进程处理方式，需要分别观察。可恢复缺页修复后会重试，非法访问可能导致终止。

## 第 11 页｜System Calls——系统调用

> Linux x86-64 为各系统调用分配编号。

| 课件编号 | 名称 | 作用 |
|---:|---|---|
| 0 | read | 读取文件描述符 |
| 1 | write | 写入文件描述符 |
| 2 | open | 打开文件 |
| 3 | close | 关闭文件描述符 |
| 4 | stat | 获取文件信息 |
| 57 | fork | 创建子进程 |
| 59 | execve | 装入并执行程序 |
| 60 | exit，原页标为 _exit | 内核终止调用线程的路径 |
| 62 | kill | 向进程等目标发送信号 |

这些编号采用 Linux x86-64 的系统调用 ABI。程序常通过 C 库函数使用这些服务。

编号 60 对应内核 exit 调用。现代 glibc 的 _exit 封装通常调用 exit_group 来结束整个进程的线程组；本讲大部分例题使用单线程进程。[Linux \_exit 接口说明](https://man7.org/linux/man-pages/man2/_exit.2.html)

## 第 12 页｜Opening File——打开文件的系统调用

![第12页open封装与syscall指令](Attachments/lec14-ecf-procs/page-12.png)

> 用户调用 open(filename, options)。
>
> 库封装准备参数并执行 syscall 指令。
>
> 系统调用号放在 rax，参数使用 rdi、rsi、rdx、r10、r8、r9，返回值放在 rax。

课件反汇编的关键指令为

~~~asm
mov $0x2, %eax
syscall
cmp $0xfffffffffffff001, %rax
~~~

第一条准备编号 2，第二条进入系统调用入口。返回后检查内核返回值。

0xfffffffffffff001 在 64 位补码中对应 -4095。Linux 原始系统调用使用负 errno 范围编码错误，库封装通常再转换为返回 -1 并设置 errno。

系统调用入口完成特权级与执行路径转换，内核随后依据 rax 中的编号选择服务。

本页反汇编展示课件当时的 open 实现。现代 glibc 的 open 封装可以通过 openat 等内核接口完成相应工作。[open 接口及库实现说明](https://man7.org/linux/man-pages/man2/open.2.html)

## 第 13 页｜Page Fault——可恢复的缺页故障

![第13页缺页后重试指令](Attachments/lec14-ecf-procs/page-13.png)

课件示例在全局数组中写入一个元素。

~~~c
int a[1000];

int main(void)
{
    a[500] = 13;
    return 0;
}
~~~

> 用户写入的目标页当前在磁盘上。
>
> 写入指令引发 page fault，内核把页面取回内存。
>
> 返回并重新执行原来的 movl。

本页采用页面已被换出或需要从磁盘取得内容的情形。页映射恢复后，同一条写入指令再次执行，才能完成 a[500]=13。

缺页也可能通过零页分配、写时复制等方式处理。这里全局数组的首次访问本身，也可以涉及零初始化页面的按需建立。具体处理由页面来源和故障原因决定。

## 第 14 页｜Invalid Memory Reference——非法地址访问

![第14页非法地址与SIGSEGV](Attachments/lec14-ecf-procs/page-14.png)

~~~c
int a[1000];

int main(void)
{
    a[5000] = 13;
    return 0;
}
~~~

> 本例的目标地址引发缺页异常。
>
> 内核发现地址无效，向进程发送 SIGSEGV，进程通常以 segmentation fault 结束。

按 4 字节 int，a[5000] 距数组起点 20,000 B，而整个数组只有 4,000 B。

本例把访问位置设为没有合法映射或权限的区域。在 C 语言层面，这次数组越界已经属于未定义行为。硬件根据页映射和权限检查地址，C 数组的长度规则属于程序语义。实际越界运行可能破坏其他数据，也可能出现访问异常，不能保证每次越界都会触发 SIGSEGV。

## 第 15 页｜Today——进入进程

> 异常控制流、异常、进程、进程控制。

当前强调“进程”。接下来用逻辑控制流与私有地址空间解释多个程序怎样共同运行。

## 第 16 页｜Processes——进程

![第16页进程的两个抽象](Attachments/lec14-ecf-procs/page-16.png)

> 进程是正在运行的程序的一个实例。
>
> 进程提供逻辑控制流，让程序具有独占 CPU 的执行视角，依靠上下文切换实现。
>
> 进程提供私有地址空间，让程序具有独立内存的使用视角，依靠虚拟内存实现。

| 名称 | 含义 |
|---|---|
| 程序 | 保存的代码与数据，例如可执行文件 |
| 进程 | 程序运行时的一个实例及其执行状态 |
| 处理器 | 执行指令的硬件资源 |

同一个程序可以产生多个进程。各实例有自己的执行位置、寄存器状态、栈等信息。

私有地址空间描述进程的虚拟地址视角，底层物理内存仍由系统统一管理，也可以按机制共享部分页面。

## 第 17 页｜Multiprocessing: The Illusion——多进程的使用视角

> 系统可以同时维持许多进程。
>
> 包括浏览器、邮件客户端、编辑器等应用，以及监控网络、I/O 等后台任务。

图给每个程序都画了 CPU、寄存器、代码、数据、堆和栈，用于表示每个进程看到的独立执行环境。

多个进程的运行机会和物理资源由内核安排。单核可以交错执行，多核还可以同时执行多条进程控制流。

## 第 18 页｜Multiprocessing Example——观察系统进程

![第18页Mac进程观察示例](Attachments/lec14-ecf-procs/page-18.png)

> 课件在 Mac 上运行 top。
>
> 截图中共有 123 个进程，其中 5 个处于所示活动状态。
>
> 每个进程由进程 ID，即 PID 标识。

这些数量来自课堂截图。观察工具还会列出 CPU 时间、内存使用、状态等指标，帮助把运行中的程序实例与具体 PID 联系起来。

后面的父子进程例题，会用 getpid、getppid 直接获得相关身份。

## 第 19 页｜Traditional Multiprocessing——单核上的交错执行

![第19页单核与保存的进程状态](Attachments/lec14-ecf-procs/page-19.png)

> 单处理器可以并发执行多个进程，各进程执行片段交错。
>
> 虚拟内存系统管理各进程的地址空间。
>
> 当前未执行的进程，其寄存器值保存在内存中。

图中一个 CPU 正在执行某进程，其他进程的代码、数据、堆、栈以及保存的执行状态仍由系统维护。

运行机会切换后，被暂停的程序可以从保存的执行位置继续。下面三页把切换拆成保存、选择、恢复三个阶段。

## 第 20 页｜Traditional Multiprocessing——保存当前状态

> 把当前寄存器状态保存到内存。

当前进程暂停执行时，内核保存恢复它所需的上下文，例如指令位置、栈相关状态和其他寄存器信息。

图中箭头从 CPU 指向当前进程的 Saved registers 区域，表示把这次执行状态保存下来。

## 第 21 页｜Traditional Multiprocessing——选择下一进程

> 调度下一个进程执行。

调度器根据可运行任务与调度规则，选择接下来取得执行机会的进程。

图中的活动位置从左侧进程转到中间进程。选择任务与恢复其寄存器，是上下文切换中的不同步骤。

## 第 22 页｜Traditional Multiprocessing——恢复状态与地址空间

![第22页恢复下一进程](Attachments/lec14-ecf-procs/page-22.png)

> 装入此前保存的寄存器，并切换地址空间，完成上下文切换。

CPU 取得新进程的执行位置和栈等上下文，同时使用相应地址空间的映射。

随后，新进程从自己的执行点继续。用户代码在某次暂停前后的寄存器状态和虚拟内存视角，由这组机制衔接。

## 第 23 页｜Modern Multiprocessing——多核执行

![第23页多核与进程](Attachments/lec14-ecf-procs/page-23.png)

> 多核处理器把多个执行核心放在同一芯片上。
>
> 它们共享主存，以及部分缓存。
>
> 各核心可以执行不同进程，内核负责把进程调度到核心。

单核可以通过交错执行维持并发。多核提供多个同时执行的硬件位置，也可以让多个进程真正并行。

进程数量仍然可以多于核心数量，调度与上下文切换继续发挥作用。

原页的调度描述应理解为把 processes 调度到 cores。

## 第 24 页｜Concurrent Processes——并发进程

![第24页并发进程时间图](Attachments/lec14-ecf-procs/page-24.png)

> 每个进程是一个逻辑控制流。
>
> 两个逻辑流的执行区间在时间上重叠，就称为并发。
>
> 时间区间依次完成时，属于顺序关系。
>
> 单核图中 A 与 B、A 与 C 并发，B 与 C 顺序。

并发讨论的是逻辑执行区间重叠。一个进程暂停、另一个进程执行时，两者都可能尚未完成。

并行进一步要求有同时执行的硬件机会。图按单核绘制，在每个实际执行片段只有一个进程使用该核心。

## 第 25 页｜User View of Concurrent Processes——用户视角

> 在图示单核执行中，不同进程实际使用 CPU 的片段在时间上分开。
>
> 从程序使用者视角，可以把它们看作同时推进的控制流。

浏览器、编辑器等应用都持续有响应，背后可能是执行片段频繁切换，也可能结合多核并行。

分析并发代码时，应该记录各进程内部必须遵守的先后关系，以及跨进程之间由创建、等待等机制建立的关系。

## 第 26 页｜Context Switching——上下文切换

![第26页经过内核完成切换](Attachments/lec14-ecf-procs/page-26.png)

> 进程由驻留内存的操作系统内核代码管理。
>
> 控制流通过上下文切换从一个进程转到另一个进程。

图中进程 A 的用户代码进入内核，内核保存 A、选择并恢复 B，随后 B 的用户代码继续执行。以后可以再次切回 A。

系统调用或中断处理可以在现有任务的上下文中进入内核，调度过程再改变正在执行的任务。Linux 也存在执行后台工作的内核线程。

这张图突出用户态与内核态的交接，以及保存、恢复执行环境的过程。

## 第 27 页｜Today——进入进程控制接口

> 异常控制流、异常、进程、进程控制。

当前强调“进程控制”。后续以 C 接口研究创建、终止、等待、回收和装入程序。

## 第 28 页｜System Call Error Handling——系统接口错误处理

> Linux 的许多系统接口失败时返回 -1，并通过 errno 给出原因。
>
> 调用系统接口时，应按其约定检查返回状态。

原例在 fork 出错时打印信息，并调用 exit(0)。整理版使用 EXIT_FAILURE 表达失败。

~~~c
pid_t pid = fork();
if (pid < 0) {
    fprintf(stderr, "fork error: %s\n", strerror(errno));
    exit(EXIT_FAILURE);
}
~~~

fork 返回非负值时，按照父、子两条正常路径继续。返回 -1 时，创建失败，应处理错误。

errno 需要结合调用结果解释。现代实现通常为每个线程维护自己的 errno 值。[errno 接口说明](https://man7.org/linux/man-pages/man3/errno.3.html)

## 第 29 页｜Error-reporting Functions——封装错误报告

> 可以把重复的错误报告逻辑放进函数。

~~~c
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void unix_error(const char *msg)
{
    int saved_errno = errno;
    fprintf(stderr, "%s: %s\n", msg, strerror(saved_errno));
    exit(EXIT_FAILURE);
}
~~~

调用点可以写为

~~~c
if ((pid = fork()) < 0)
    unix_error("fork error");
~~~

辅助函数记录当前错误号，输出调用方给出的上下文和系统错误描述。此处同样把原页 exit(0) 整理为失败状态。

## 第 30 页｜Error-handling Wrappers——带错误检查的包装

> 使用 Stevens 风格的错误处理包装，让示例的调用点更简洁。

~~~c
#include <sys/types.h>
#include <unistd.h>

pid_t Fork(void)
{
    pid_t pid = fork();
    if (pid < 0)
        unix_error("Fork error");
    return pid;
}
~~~

调用时可以直接写

~~~c
pid = Fork();
~~~

本讲大写 Fork 是教学包装函数。成功时保留 fork 的父子返回值，失败时交给错误报告函数。

后面的整理代码沿用本页 Fork 和第 29 页 unix_error，测试程序会包含对应头文件。

## 第 31 页｜Obtaining Process IDs——获取进程身份

~~~c
pid_t getpid(void);
pid_t getppid(void);
~~~

> getpid 返回当前进程 PID。
>
> getppid 返回调用时的父进程 PID。

fork 成功后，父子进程具有不同 PID。子进程最初的父 PID 指向创建它的进程，之后重新收养等事件可以改变父子关系。

pid_t 是进程 ID 使用的类型，后面 fork、wait、waitpid 的返回值也采用它。

## 第 32 页｜Process States——本讲的进程状态模型

> 从程序员视角，本讲采用运行、停止、终止三类状态。

| 类别 | 原文含义 |
|---|---|
| Running | 正在执行，或等待被调度执行 |
| Stopped | 执行暂停，等待进一步通知后再调度 |
| Terminated | 执行已经永久结束 |

这三类用于后面的创建、暂停、继续和退出讨论。Linux 实际还区分睡眠、等待和僵尸等更具体状态。

执行结束与回收退出记录是两个步骤，第 42 页会进一步解释僵尸状态。

## 第 33 页｜Terminating Processes——终止进程

> 进程可以因终止信号、main 返回或调用 exit 而结束。
>
> exit(status) 携带退出状态，约定 0 表示成功，非零表示失败。
>
> exit 调用后不返回。

~~~c
void exit(int status);
~~~

从 main 返回整数，也可以给出相应的正常退出状态。

exit 属于 C 库退出路径，会处理注册的退出操作和 stdio 缓冲等清理。_exit 提供更直接的终止路径，不执行这些 C 库清理。[Linux 退出接口说明](https://man7.org/linux/man-pages/man2/_exit.2.html)

后面 wait 返回的 status 还包含终止原因等编码，需要用相应宏提取退出码。

## 第 34 页｜Creating Processes——fork 创建子进程

> 父进程通过 fork 创建子进程。
>
> 成功时子进程得到 0，父进程得到子 PID。
>
> 子进程获得逻辑上相同而独立的地址空间，以及对应的文件描述符。
>
> 成功的 fork 调用一次，出现父、子两条返回路径。

标准接口为

~~~c
pid_t fork(void);
~~~

| 返回位置 | 返回值 |
|---|---|
| 父进程 | 子进程 PID，大于 0 |
| 子进程 | 0 |
| 创建失败的调用方 | -1，并设置 errno |

Linux 通常通过写时复制 COW 实现地址空间复制。父子开始时可以共享底层页面，写入时再为需要独立修改的内容建立副本。

父子文件描述符指向相同的打开文件描述，因此可以共享文件偏移等内核状态。[fork 接口说明](https://man7.org/linux/man-pages/man2/fork.2.html)

## 第 35 页｜fork Example——父子进程各自修改 x

![第35页fork与变量副本](Attachments/lec14-ecf-procs/page-35.png)

~~~c
int main(void)
{
    pid_t pid;
    int x = 1;

    pid = Fork();
    if (pid == 0) {
        printf("child : x=%d\n", ++x);
        exit(0);
    }

    printf("parent: x=%d\n", --x);
    exit(0);
}
~~~

fork 返回时，父子各自的 x 都为 1。子进程把自己的 x 加到 2，父进程把自己的 x 减到 0。

两条记录分别是 child x=2 与 parent x=0，先后顺序由调度决定。

stdout 对应的打开文件资源由父子共享，所以两份输出可以到达同一个终端。x 的后续修改则分别作用于各自地址空间。

本例可配合第 29–30 页的辅助函数编译。

## 第 36 页｜Process Graphs——用进程图表达先后关系

> 顶点表示一次语句执行。
>
> 边 a→b 表示 a 必须先于 b。
>
> 边可以标注变量值，printf 顶点可以标注输出内容。
>
> 图从没有入边的起点开始。
>
> 在该抽象模型中，符合所有边约束的拓扑排序，对应一种可行总顺序。

同一进程的语句按控制流推进。fork 建立分支，wait 等同步操作会建立额外的跨分支先后关系。

课件把一次 printf 的完整输出当作一个可见事件，下面的顺序题沿用这个模型。验证程序在 main 开始处显式设置行缓冲，配合每条短记录末尾的换行，让这些示例在本次 Linux/glibc 测试中按整行观察。

~~~c
setvbuf(stdout, NULL, _IOLBF, 0);
~~~

C 标准本身不保证跨进程的 printf 整行原子性。无缓冲只影响缓冲策略，一次 printf 仍可能拆成多次底层写入，出现字符级交错。课件模型用于分析语句间的先后关系。实际日志还要考虑每条记录的写入方式、长度和目标设备。[stdio 缓冲接口说明](https://man7.org/linux/man-pages/man3/setbuf.3.html)

## 第 37 页｜Process Graph Example——把 fork 程序画成进程图

> 左侧为第 35 页的父子进程程序，右侧为对应的进程图。
>
> fork 前 x=1。子进程输出 child: x=2，父进程输出 parent: x=0，各自随后退出。

![第 37 页的父子进程图](Attachments/lec14-ecf-procs/page-37.png)

可以按下面四步读图。

1. 沿主干执行到 fork，此时只有原来的进程。
2. fork 成功后出现两个执行分支，每个分支都有自己的 x=1。
3. 子分支执行 ++x，得到 2。父分支执行 --x，得到 0。
4. 每个分支都先 printf，再 exit。两个分支之间没有规定谁先 printf。

~~~text
                         子进程 printf(x=2) → exit
                        ↗
main，x=1 → fork 成功
                        ↘
                         父进程 printf(x=0) → exit
~~~

图上的一条边只规定先后关系。边的长短、分支画在上方还是下方，都不代表耗时或调度优先级。

## 第 38 页｜Interpreting Process Graphs——判断一个执行顺序是否可行

> 上图是原始进程图，下图把各顶点重新标为 a、b、c、d、e、f。
>
> 可行的总顺序为 a b e c f d。
>
> 不可行的总顺序为 a b f c e d。

![第 38 页的顶点编号与执行顺序](Attachments/lec14-ecf-procs/page-38.png)

| 顶点 | 执行事件 | 必须满足的关系 |
| --- | --- | --- |
| a | main 中初始化 | a 在 b 前 |
| b | fork 分叉 | b 在 c、e 前 |
| c | 父进程 printf | c 在 d 前 |
| d | 父进程 exit | 等待本分支的 c |
| e | 子进程 printf | e 在 f 前 |
| f | 子进程 exit | 等待本分支的 e |

因此，两条必须保持的链是

$$
a\rightarrow b\rightarrow c\rightarrow d
$$

$$
a\rightarrow b\rightarrow e\rightarrow f
$$

检查 `a b e c f d` 时，父分支 c→d、子分支 e→f 都成立，所以可行。

检查 `a b f c e d` 时，f 出现在 e 前面，相当于子进程先退出、再执行退出前的 printf，违反程序顺序。

做题时先写出每个进程内部的先后关系，再检查候选顺序是否违背任何一条边。多个分支可以交错出现。

## 第 39 页｜Two Consecutive Forks——连续执行两次 fork

> 两次连续的 fork。
>
> 图中给出一种可行输出和一种不可行输出。

![第 39 页的连续两次 fork](Attachments/lec14-ecf-procs/page-39.png)

下面沿用第 30 页的 Fork 包装函数。它在 fork 失败时报告错误，成功时与原页的 fork 有相同分支行为。

~~~c
void fork2(void)
{
    printf("L0\n");
    Fork();
    printf("L1\n");
    Fork();
    printf("Bye\n");
}
~~~

执行次数按程序位置计算。

| 位置 | 到达这里的进程数 | 输出次数 |
| --- | --- | --- |
| 第一个 Fork 前 | 1 | L0 一次 |
| 第一个 Fork 后 | 2 | L1 两次 |
| 第二个 Fork 后 | 4 | Bye 四次 |

第二个 Fork 会由第一轮得到的两个进程分别执行，所以总进程数从 2 变为 4。

$$
\text{最终进程数}=2^2=4
$$

更一般地，如果所有存活分支都成功执行连续 n 次 fork，最终有 $2^n$ 个进程，包含最初的进程，共新建 $2^n-1$ 个子进程。条件分支中的 fork 要逐条分析，不能直接套这个公式。

原页的可行输出为

~~~text
L0 L1 Bye Bye L1 Bye Bye
~~~

第一轮中的某个分支可以先完成自己的第二次 fork，让该支的两个进程打印 Bye，然后另一个分支才打印 L1。

原页的不可行输出为

~~~text
L0 Bye L1 Bye L1 Bye Bye
~~~

任何一个 Bye 都需要沿某条分支经过 L1，再经过第二个 Fork。因此第一个 L1 前不会出现 Bye。

本页采用第 36 页按整行观察的输出模型。实际重定向 stdout 时，如果 fork 前有尚未刷出的 stdio 缓冲内容，缓冲区也会随地址空间复制。随后多个进程调用 exit，可能重复刷出这些旧内容。分析终端打印题时，要同时明确缓冲条件。[Linux fork 文档](https://man7.org/linux/man-pages/man2/fork.2.html)

## 第 40 页｜Nested Forks in Parent——只有父分支继续创建进程

> 在父进程分支中嵌套调用 fork。

![第 40 页的父分支嵌套 fork](Attachments/lec14-ecf-procs/page-40.png)

~~~c
void fork4(void)
{
    printf("L0\n");
    if (Fork() != 0) {
        printf("L1\n");
        if (Fork() != 0) {
            printf("L2\n");
        }
    }
    printf("Bye\n");
}
~~~

设最初的进程为 P，两次创建的子进程为 C1、C2。

1. P 输出 L0，第一次 Fork 创建 C1。
2. C1 得到返回值 0，跳过外层 if，只输出 Bye。
3. P 得到正的子 PID，进入外层 if，输出 L1，并创建 C2。
4. C2 得到返回值 0，跳过内层 if，输出 Bye。
5. P 得到正的子 PID，输出 L2，最后输出 Bye。

~~~text
P     L0 → Fork → L1 → Fork → L2 → Bye
             ↘          ↘
C1            Bye        
C2                        Bye
~~~

最终共 3 个进程。L0、L1、L2 各输出一次，Bye 输出三次。

原页的可行输出是 `L0 L1 Bye Bye L2 Bye`。P 可以在输出 L2 前让两个子进程先完成。

原页的不可行输出是 `L0 Bye L1 Bye Bye L2`。L2 前最多出现 C1、C2 的两个 Bye。P 自己的 Bye 必须位于 L2 后，所以三个 Bye 全在 L2 前不成立。

## 第 41 页｜Nested Forks in Children——只有子分支继续创建进程

> 在子进程分支中嵌套调用 fork。

![第 41 页的子分支嵌套 fork](Attachments/lec14-ecf-procs/page-41.png)

~~~c
void fork5(void)
{
    printf("L0\n");
    if (Fork() == 0) {
        printf("L1\n");
        if (Fork() == 0) {
            printf("L2\n");
        }
    }
    printf("Bye\n");
}
~~~

1. P 输出 L0，第一次 Fork 创建 C1。
2. P 得到正数，跳过外层 if，只输出自己的 Bye。
3. C1 得到 0，进入外层 if，输出 L1，第二次 Fork 创建 C2。
4. C1 得到正数，跳过内层 if，输出自己的 Bye。
5. C2 得到 0，输出 L2，再输出自己的 Bye。

~~~text
P     L0 → Fork → Bye
             ↘
C1            L1 → Fork → Bye
                      ↘
C2                     L2 → Bye
~~~

同样有 3 个进程，L0、L1、L2 各一次，Bye 三次。与第 40 页相比，第二次 fork 由 C1 执行，C2 成为 P 的孙进程。

原页的可行输出为 `L0 Bye L1 L2 Bye Bye`。P 先打印 Bye，接着子分支执行。

原页的不可行输出为 `L0 Bye L1 Bye Bye L2`。C2 的 Bye 必须在它自己的 L2 后。L2 前最多有 P 和 C1 的两个 Bye。

第 40–41 页说明，输出次数相同的程序可以具有不同的进程树。还需要看每次 fork 是由哪个现存进程执行的。

## 第 42 页｜Reaping Child Processes——回收已经终止的子进程

> 进程终止后，仍会保留一些系统资源，例如退出状态和部分操作系统表项。这种状态称为 zombie，僵尸进程。
>
> 父进程调用 wait 或 waitpid 回收已终止的子进程，取得退出信息，随后内核清除相应的僵尸进程记录。
>
> 原页说明，父进程没有回收就终止时，子进程会由 init 接管，并强调 shell、服务器等长期运行程序需要主动回收子进程。

把“退出”和“回收”分开看就容易理解。

~~~text
子进程运行
    ↓ exit 或其他终止原因
子进程停止执行，保留 PID、退出状态等记录
    ↓ 父进程成功 wait / waitpid
父进程取得结果，内核清除剩余记录
~~~

僵尸进程已经结束执行，通常的大部分运行资源已经释放。它保留退出记录，让父进程有机会知道“哪个孩子结束了、为什么结束”。大量未回收记录仍会占用进程表等资源。

“孤儿”描述父进程已经结束的亲缘关系，子进程此时可能仍在运行，也可能已经成为僵尸。现代 Linux 会把这类进程交给最近的存活子收割者 subreaper，或所在 PID 命名空间的 init 进程。收养者负责在孩子终止后等待回收。[Linux wait 文档](https://man7.org/linux/man-pages/man2/waitpid.2.html)

原页“只有长期运行程序需要显式回收”强调的是积累风险。短程序也常常需要 wait，以确认任务完成、取得退出状态和维持规定的执行顺序。

## 第 43 页｜Zombie Example——父进程运行，子进程成为僵尸

> 子进程打印自己的 PID 后终止。
>
> 父进程打印自己的 PID 后无限循环。
>
> ps 将子进程显示为 defunct，即僵尸进程。
>
> 结束父进程后，子进程可以被接管并回收。

![第 43 页的僵尸进程示例](Attachments/lec14-ecf-procs/page-43.png)

~~~c
void fork7(void)
{
    if (Fork() == 0) {
        printf("Terminating Child, PID = %ld\n", (long)getpid());
        exit(0);
    } else {
        printf("Running Parent, PID = %ld\n", (long)getpid());
        while (1) {
        }
    }
}
~~~

原页终端里的父 PID 是 6639，子 PID 是 6640。子进程退出后，ps 中仍有 `forks <defunct>`，因为 6639 持续运行，也没有调用 wait。

示例随后结束父进程，使僵尸子进程被接管、回收。日常程序应在父进程中安排 wait/waitpid。这里的无限循环用于维持演示状态，会持续占用 CPU。

图中 PID 是那次运行的结果。自己运行时应根据当前程序输出识别父子 PID。验证本例时需由监督程序记录本次创建的进程，并在观察到僵尸状态后结束和回收它们。

## 第 44 页｜Non-terminating Child Example——父进程结束，孩子仍运行

> 父进程终止后，子进程仍然活跃。
>
> 示例中的子进程执行无限循环，需要另外结束它，否则会一直运行。

![第 44 页的存活孤儿进程示例](Attachments/lec14-ecf-procs/page-44.png)

~~~c
void fork8(void)
{
    if (Fork() == 0) {
        printf("Running Child, PID = %ld\n", (long)getpid());
        while (1) {
        }
    } else {
        printf("Terminating Parent, PID = %ld\n", (long)getpid());
        exit(0);
    }
}
~~~

原页中父进程 6675 终止，子进程 6676 继续运行，随后单独结束 6676。

父进程调用 exit 只终止调用它的那个进程。子进程拥有独立的执行状态，可以继续被调度。父进程结束后，操作系统为它安排新的父进程。

和上一页对照看，差异发生在子进程的状态。

| 页码 | 父进程 | 子进程 | 观察到的情况 |
| --- | --- | --- | --- |
| 43 | 活着，未 wait | 已退出 | 保留僵尸记录 |
| 44 | 已退出 | 活着，持续循环 | 存活的孤儿进程被接管 |

接管保证后续能有人回收退出状态。活着的孩子继续执行原来的代码。

## 第 45 页｜wait——等待并回收一个子进程

> 父进程通过 wait 回收子进程。
>
> 当没有可立即报告的子进程退出状态时，调用者会等待。
>
> 返回值为被回收子进程的 PID。
>
> 如果状态指针非空，函数通过它写出终止原因和退出状态。通过宏读取这些信息。

标准声明位于 `<sys/wait.h>`。原页返回类型简写成 int，这里使用 pid_t。

~~~c
pid_t wait(int *wstatus);
~~~

可以将一次成功的 wait 理解成“领取一个孩子的结果”。若某个孩子早已终止，wait 可以立即返回。没有尚可等待的子进程时返回 -1，并设置 errno 为 ECHILD。

`wstatus` 指向的整数包含编码信息。按对应条件提取字段。

| 条件宏 | 成立时可使用的宏 | 含义 |
| --- | --- | --- |
| WIFEXITED(status) | WEXITSTATUS(status) | 经 exit、_exit 或从 main 返回而终止，读取退出码 |
| WIFSIGNALED(status) | WTERMSIG(status) | 被信号终止，读取信号编号 |
| WIFSTOPPED(status) | WSTOPSIG(status) | 子进程停止，读取停止信号 |
| WIFCONTINUED(status) | 无需提取退出码 | 子进程因 SIGCONT 恢复 |

通常的 wait 关注终止。观察未被跟踪子进程的停止、继续状态，需要使用 waitpid 的 WUNTRACED、WCONTINUED 等选项。

退出码 0 通常表示成功。`WIFEXITED` 成立表示采用正常退出路径，即使退出码是非零，它仍然成立。Linux 通过 WEXITSTATUS 取得的退出码只有低 8 位，因此教学例子中的 100、101、102 都可直接观察。[Linux wait 文档](https://man7.org/linux/man-pages/man2/waitpid.2.html)

后续示例使用下面的 Wait 包装函数，沿用前面的 unix_error。它在 EINTR，即等待被可处理的信号打断时，重新执行 wait。

~~~c
pid_t Wait(int *status)
{
    pid_t pid;

    do {
        pid = wait(status);
    } while (pid < 0 && errno == EINTR);

    if (pid < 0) {
        unix_error("Wait error");
    }
    return pid;
}
~~~

## 第 46 页｜wait——建立跨进程的先后关系

> 子进程输出 HC 后退出。
>
> 父进程输出 HP，wait 等待孩子结束，再输出 CT 和 Bye。

![第 46 页中 wait 建立的同步边](Attachments/lec14-ecf-procs/page-46.png)

~~~c
void fork9(void)
{
    int child_status;

    if (Fork() == 0) {
        printf("HC: hello from child\n");
        exit(0);
    } else {
        printf("HP: hello from parent\n");
        Wait(&child_status);
        printf("CT: child has terminated\n");
    }
    printf("Bye\n");
}
~~~

需要同时保持两条顺序链。

~~~text
子分支    HC → 子进程退出 ─────────┐
                                  ↓
父分支    HP → Wait 成功返回 → CT → Bye
~~~

HP 可以先于 HC，也可以后于 HC。CT 一定在 HP 和 HC 之后，Bye 一定在 CT 之后。

因此 `HC HP CT Bye` 与 `HP HC CT Bye` 都可行。原页的 `HP CT Bye HC` 不可行，因为子进程尚未打印 HC 时，父进程的 Wait 不可能已经成功回收这个子进程。

只有父进程输出最后的 Bye。子进程执行 exit 后不会继续落到函数末尾。

wait 不负责决定两个进程最开始谁运行，它在“孩子终止”与“父进程成功返回”之间建立同步关系。

## 第 47 页｜Another wait Example——按可回收顺序领取多个结果

> 如果多个子进程已经完成，wait 可以按任意顺序返回其中的子进程。
>
> 使用 WIFEXITED 和 WEXITSTATUS 获得退出信息。

![第 47 页等待多个子进程](Attachments/lec14-ecf-procs/page-47.png)

原页用 pid 数组记录创建结果，但本页随后没有按数组指定等待对象。整理后的版本省去这个未使用的数组，并使用前面的 Fork、Wait 检查错误。

~~~c
#define N 3

void fork10(void)
{
    for (int i = 0; i < N; i++) {
        if (Fork() == 0) {
            exit(100 + i);
        }
    }

    for (int i = 0; i < N; i++) {
        int child_status;
        pid_t wpid = Wait(&child_status);

        if (WIFEXITED(child_status)) {
            printf("Child %ld terminated with exit status %d\n",
                   (long)wpid, WEXITSTATUS(child_status));
        } else {
            printf("Child %ld terminated abnormally\n", (long)wpid);
        }
    }
}
~~~

第一个循环的每个子进程都会立即 exit，只有父进程继续循环，所以 N=3 时一共创建 3 个孩子，进程总数为 4。

| 创建轮次 i | 子进程退出码 |
| --- | --- |
| 0 | 100 |
| 1 | 101 |
| 2 | 102 |

第二个循环执行 3 次 Wait，每次领取一个结果。它没有指定“先等第几个孩子”，所以打印顺序可能是 100、101、102，也可能是 102、100、101 等。

即使某次实验连续观察到相同顺序，程序也没有获得这个顺序的接口保证。多个退出状态已就绪时，也不能把返回顺序理解为严格的退出时间排序。

## 第 48 页｜waitpid——指定等待哪个孩子

> 等待指定进程终止。
>
> 还可以通过 options 选择其他等待行为。

![第 48 页按逆序指定 waitpid 对象](Attachments/lec14-ecf-procs/page-48.png)

原页原型里的 `int &status` 是 C 代码中的笔误。正确声明使用指针。

~~~c
pid_t waitpid(pid_t pid, int *wstatus, int options);
~~~

本例 pid>0，选择具有该 PID 的一个子进程。`waitpid(-1, &status, 0)` 的等待对象范围与 wait 相同。options=0 时，如果目标尚未终止，就等待它终止。

先给出与 Wait 相同风格的错误检查包装，便于阅读后面的循环。

~~~c
pid_t Waitpid(pid_t child, int *status, int options)
{
    pid_t pid;

    do {
        pid = waitpid(child, status, options);
    } while (pid < 0 && errno == EINTR);

    if (pid < 0) {
        unix_error("Waitpid error");
    }
    return pid;
}
~~~

~~~c
void fork11(void)
{
    pid_t pid[N];

    for (int i = 0; i < N; i++) {
        pid[i] = Fork();
        if (pid[i] == 0) {
            exit(100 + i);
        }
    }

    for (int i = N - 1; i >= 0; i--) {
        int child_status;
        pid_t wpid = Waitpid(pid[i], &child_status, 0);

        if (WIFEXITED(child_status)) {
            printf("Child %ld terminated with exit status %d\n",
                   (long)wpid, WEXITSTATUS(child_status));
        } else {
            printf("Child %ld terminated abnormally\n", (long)wpid);
        }
    }
}
~~~

沿用 N=3，父进程按 pid[2]、pid[1]、pid[0] 逐个等待。因此三条结果的退出码固定按 102、101、100 打印。

这个循环规定的是回收和报告顺序。三个孩子实际获得 CPU、执行 exit 的先后仍由调度决定。例如孩子 0 已经退出，父进程仍可先等待尚未退出的孩子 2。

如果设置 WNOHANG，目标存在但还没有可报告状态时，waitpid 可返回 0。这种用法要先判断返回值，再决定是否解读 status。本页示例的 options=0，不会走这个分支。[Linux waitpid 文档](https://man7.org/linux/man-pages/man2/waitpid.2.html)

## 第 49 页｜execve——在当前进程中装入新程序

> 装入并运行 filename 指定的文件，可以是可执行程序，也可以是以 #!interpreter 开头的解释器脚本。
>
> argv 提供参数列表，按惯例 argv[0] 为程序名。
>
> envp 提供环境变量列表，每项是 name=value 形式的字符串，例如 USER=droh。相关接口或命令包括 getenv、putenv、printenv。
>
> 原有代码、数据与栈被新程序映像替换。
>
> 成功后从新程序的入口开始执行，发生错误时才返回。

当前声明为

~~~c
int execve(const char *path, char *const argv[], char *const envp[]);
~~~

将它与 fork 连起来看。

~~~text
原进程 P
    ↓ fork
父进程 P 继续原程序             子进程 C 执行原程序的 fork 后续代码
                                      ↓ execve 成功
                                子进程 C 开始运行新程序
~~~

execve 成功后，C 的 PID 仍然是 C，程序映像已经换成新程序。调用点后面的旧代码只会在 execve 返回 -1 时继续执行，此时 errno 说明失败原因。

参数列表 argv 和环境列表 envp 都是以 NULL 指针结束的指针数组。每个指针指向一条以零字节结尾的字符串。`execve` 本身按给定路径查找文件，不自动搜索 PATH。

原页关于继承关系需要补充条件。

| 属性 | execve 成功后的情况 |
| --- | --- |
| PID | 保留 |
| 用户态代码、数据、堆、栈 | 换成新程序的映像 |
| 打开的文件描述符 | 通常保留，设置 FD_CLOEXEC 的描述符关闭 |
| 捕获信号的处理函数 | 重置为默认处理方式 |
| 信号屏蔽字、被忽略的信号设置 | Linux 通常保留，详细规则见接口文档 |

所以原页“保留 signal context”不能直接理解为所有旧信号处理函数都继续有效。[Linux execve 文档](https://man7.org/linux/man-pages/man2/execve.2.html)

## 第 50 页｜新程序启动时，参数与环境放在哪里

> 图中展示新程序启动时的栈结构。
>
> 栈中包含以零字节结束的参数字符串、环境变量字符串，以及指向它们的 argv、envp 指针数组。
>
> argv[argc] 为 NULL，envp 的最后一项也为 NULL。
>
> 全局变量 environ 指向环境指针数组。

![第 50 页的程序参数、环境与栈](Attachments/lec14-ecf-procs/page-50.png)

以命令 `ls -lt /usr/include` 为例，可以把关系写成

~~~text
argc = 3

argv ──→ [ 指向 "/bin/ls"     ]
         [ 指向 "-lt"         ]
         [ 指向 "/usr/include"]
         [ NULL               ]

envp ──→ [ 指向 "USER=awaken" ]
         [ 指向 "PATH=..."    ]
         [ ...                ]
         [ NULL               ]
~~~

这里有三类不同的量。

1. argc 是参数数量，包含 argv[0]，不包含结尾 NULL。
2. argv 是指针数组的起始地址。argv[i] 再指向一条具体的参数字符串。
3. envp 同样是指针数组，里面每条字符串表示一个环境变量。

可以把 `argv[1]` 理解成“找到第 1 个指针，再沿指针找到字符串 -lt”。指针数组和字符串内容占据不同位置。

需要区分进入可执行文件和调用 C 的 main 两个时刻。内核按 ABI 构造初始栈，包含 argc、argv、envp 和辅助向量等数据。动态链接程序通常先经过动态链接器，再到程序入口 `_start`。运行库完成初始化后，按函数调用约定调用 main。

图中的 `%rdi`、`%rsi`、`%rdx` 应按向 main 传递 argc、argv、可选 envp 的调用视角理解。程序入口 `_start` 从初始栈提取参数，再交给 `__libc_start_main` 等启动逻辑。这张图省略了辅助向量等启动细节。[glibc x86-64 启动代码](https://github.com/bminor/glibc/blob/master/sysdeps/x86_64/start.S)、[glibc 调用 main 的代码](https://github.com/bminor/glibc/blob/master/sysdeps/generic/libc_start_call_main.h)

可移植 C 程序通常使用两个参数的 main。第三个 envp 参数属于部分实现提供的形式，POSIX 提供全局 environ 访问环境。[Linux execve 文档](https://man7.org/linux/man-pages/man2/execve.2.html)

## 第 51 页｜execve Example——子进程运行 ls

> 使用当前环境，在子进程中执行 `/bin/ls -lt /usr/include`。
>
> myargv 包含三个参数指针和一个 NULL。
>
> environ 指向当前进程的环境变量列表。
>
> 子进程调用 execve。原页在失败时打印 Command not found 并退出。

![第 51 页的 execve 参数数组](Attachments/lec14-ecf-procs/page-51.png)

完整整理版如下。父进程会等待本次创建的孩子，并读取退出结果。execve 失败时用 perror 输出实际错误原因，因为失败也可能来自权限、文件格式等因素。

~~~c
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

int main(void)
{
    pid_t pid = fork();

    if (pid < 0) {
        perror("fork");
        return EXIT_FAILURE;
    }

    if (pid == 0) {
        char *myargv[] = {"/bin/ls", "-lt", "/usr/include", NULL};

        execve(myargv[0], myargv, environ);
        perror("execve");
        _exit(127);
    }

    int status;
    pid_t result;

    do {
        result = waitpid(pid, &status, 0);
    } while (result < 0 && errno == EINTR);

    if (result < 0) {
        perror("waitpid");
        return EXIT_FAILURE;
    }

    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }
    return EXIT_FAILURE;
}
~~~

执行过程如下。

1. fork 创建孩子，父子从同一调用点继续。
2. 孩子准备 myargv，把当前 environ 作为新程序的环境。
3. execve 成功后，孩子转入 ls 的入口。ls 再解析自己的 -lt 和目录参数。
4. 父进程在 waitpid 中等这个孩子。ls 结束后，父进程取得它的退出状态。

execve 的三个实参分别是文件路径、参数指针数组、环境指针数组。它直接把列表交给新程序，本例无需 shell 来解析整条命令字符串。

只有 execve 失败时才会执行后面的 perror 和 `_exit(127)`。这里用 _exit 直接终止失败分支，避免把从父进程复制来的 stdio 缓冲或退出处理函数再执行一次。127 是本例选择的失败码。[Linux \_exit 文档](https://man7.org/linux/man-pages/man2/_exit.2.html)

## 第 52 页｜Summary——异常与进程

> 异常是需要特殊控制转移的事件。
>
> 事件可来自处理器外部，例如中断，也可与当前指令有关，例如陷阱与故障。
>
> 系统在同一时期可以有多个活跃进程。在单个逻辑处理器上，同一时刻执行其中一个进程的指令流。
>
> 每个进程都获得仿佛独占处理器和私有内存空间的抽象。

两种抽象由不同机制共同支撑。

| 进程看到的效果 | 实现机制 |
| --- | --- |
| 自己的控制流不断向前执行 | 调度与上下文切换保存、恢复执行状态 |
| 自己拥有独立地址空间 | 虚拟内存、地址转换和访问保护 |
| 请求文件、进程等系统服务 | 系统调用受控地进入内核 |
| 能应对设备和程序执行事件 | 中断与同步异常处理 |

多核机器可以同时执行多个进程。“一个执行流”的限制应对应单个逻辑处理器。原页的 single core 使用了简化模型。

## 第 53 页｜Summary Continued——进程控制接口总表

> 创建进程，调用 fork，一次调用，两次返回。
>
> 结束进程，调用 exit，一次调用，不返回。
>
> 等待并回收进程，调用 wait 或 waitpid。
>
> 装入并运行程序，调用 execve 或它的变体，成功时不返回。

| 接口 | 调用后发生什么 | 返回规则 |
| --- | --- | --- |
| fork | 创建子进程，父子分别继续 | 成功时父进程得到子 PID，孩子得到 0。失败时原进程得到 -1 |
| exit | 结束当前进程，运行正常退出清理 | 不返回 |
| wait | 等待并回收任意一个符合条件的孩子 | 成功返回子 PID，失败返回 -1 |
| waitpid | 按 PID 和选项等待孩子 | 成功报告状态时返回子 PID。WNOHANG 还可能返回 0。失败返回 -1 |
| execve | 当前进程换成新程序映像 | 成功后执行新程序，失败返回 -1 |

本讲的典型组合是

~~~text
父进程 fork
    ├─ 父分支 → waitpid → 取得孩子的退出结果 → 继续
    └─ 子分支 → execve → 新程序运行 → 退出
~~~

读进程题时，依次确定创建者和分支条件、每个进程的独立状态、各分支内部顺序，以及 wait 建立的同步边，就能计算进程数量并检查输出顺序。

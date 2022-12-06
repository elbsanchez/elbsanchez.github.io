import { Component, OnInit, HostListener, ViewChildren, AfterViewInit, QueryList, ChangeDetectorRef, ElementRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { timer, from, Subscription } from 'rxjs';
import { bufferCount, concatMap, map, multicast, tap } from 'rxjs/operators';

interface node {
  id: string
  val: number
  neighbors: Array<string>
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent  implements OnInit, AfterViewInit  {
  
  problemInput = this.fb.group({
    input: [''],
  });

  isMobile = false;

  target: string = '';
  inputText: string = '';
  outputText: string = '';
  total: string = '';

  inputNumbers: number[][] = [];
  graph: Map<string, node> | undefined;

  //tracer coordinates
  x: number | undefined;
  y: number | undefined;
  

  allPaths: string[] = [];
  goodPath: node[] = [];
  goodPathFound: boolean = false;
  connections: number[][] = [];
  unsub: Subscription = Subscription.EMPTY;


  @ViewChildren('node') nodes: QueryList<any> | undefined;

  @HostListener('window:resize', ['$event.target.innerWidth'])
  onResize(width: number) {
    this.isMobile = width < 997;
    if (this.graph){
      if (this.goodPathFound) {
        this.connections = this.addEdgesToPath(this.goodPath);
        return;
      }
      this.buildConnections(this.graph);
    }
  }

  constructor(private fb: FormBuilder, private cdRef: ChangeDetectorRef) {
  }

  ngOnInit(): void {

  }

  ngAfterViewInit(): void {
    this.nodes?.changes.subscribe(t => {
      if (this.graph) this.buildConnections(this.graph);
      this.cdRef.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.unsub.unsubscribe();
  }

  onSubmit() {

    this.reset();
    let input = this.problemInput.value.input;

    if (!this.parseInput(input)) {
      return;
    }

    let timerDelay = 850;
    let goodPathFound = false;
    this.outputText = this.solve();
    
    this.unsub = from(this.allPaths).pipe(
      concatMap((node: string) => timer((node == "good" || node == "bad" ? 0 : timerDelay)).pipe(map(() => node))),
      tap((node) => {if (goodPathFound) this.changeNodeColor(node, 'lightgreen')}),
    ).subscribe((node) => {
      
      let tag = node == "good" || node == "bad";

      if (node == "good") {
        goodPathFound = true;
        //console.log("end of good path");
      }

      if (node == "bad") {
        //console.log("end of bad path");
      }

      if (!tag) {
        const coords = this.findNodePos(node);
        if (coords.x != null && coords.y != null) {
          this.x = coords.x;
          this.y = coords.y;  
        }
      }
     

    },
      () => { },
      () => {
        if (goodPathFound) {
          this.connections = this.addEdgesToPath(this.goodPath);
          this.goodPathFound = true;
        }
        //hide tracer on complete
        this.x = undefined;
        this.y = undefined;
      });
  }

  solve(): string {

    const target = Number(this.target);
    let pyramid = new Map<string, node>();
    
    this.buildPyramid(this.inputNumbers, pyramid);
    this.graph = pyramid;

    let start = pyramid.get("00");

    if (start) {
      if (this.findPath(pyramid, start, target, start.val)) return this.outputText;
    }

    return "No Solution";
  }

 parseInput(input: string): boolean {
  const lines = input.trim().split('\n');
  console.log(lines)
  if (lines.length < 2) return false;

  let target = lines[0];
  if (isNaN(Number(target))) return false;

  console.log(target);
  this.target = target;

  let rows = []; 
  for (let i = 1; i < lines.length; i++) {
    let curr = lines[i].split(',').map(Number);
    console.log(curr);
    if (curr.every((num) => isNaN(num))) return false;
    rows.push(curr);
  }

  this.inputNumbers = rows;
  this.inputText = rows.toString();

  return true;
 }


  buildPyramid(rows: Array<Array<number>>, nodes: Map<string, node>) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows[i].length; j++) {
        let id = i + '' + j;
        let connections = [];
        if (i + 1 < rows.length) {
          connections.push((i + 1) + '' + j, (i + 1) + '' + (j + 1))
        }
        nodes.set(id, { id: id, val: rows[i][j], neighbors: connections });
      }
    }
  }

  buildConnections(pyramid: Map<string, node>) {
    let connections: number[][] = [];
    pyramid.forEach((node) => {
      node.neighbors.forEach(neighbor => {
        let other = pyramid.get(neighbor);
        if (other) connections.push(this.addConnection(node, other));
      });
    });
    this.connections = connections;
  }

  addConnection(node: node, neighbor: node) {
    let edge: number[] = [];
    const pos1 = this.findNodePos(node.id);
    if (pos1.x != null && pos1.y != null && pos1.w != null && pos1.h != null) {
      const pos2 = this.findNodePos(neighbor.id);
      if (pos2.x != null && pos2.y != null && pos2.w != null && pos2.h != null) {
        edge = [pos1.x + pos1.w / 2, pos1.y + pos1.h / 2, pos2.x + pos2.w / 2, pos2.y + pos2.h / 2];
      }
    }
    return edge;
  }

  addEdgesToPath(path: node[]){
    let edges: number[][] = [];
    for (let i = 1; i < path.length; i++) {
      let edge = this.addConnection(path[i - 1], path[i]);
      if (edge.length) edges.push(edge);
    }
    return edges;
  }


  findPath(pyramid: Map<string, node>, start: node, target: number, mult: number, path: string = ""): boolean {

    if (start.neighbors.length == 0) {
      if (target == mult) {
        this.allPaths.push("good", start.id);
        this.goodPath.push(start);
        this.outputText = path;
        return true;
      }
      this.allPaths.push("bad", start.id);
      return false;
    }

    this.allPaths.push(start.id);

    let [left, right] = start.neighbors;
    let leftNode = pyramid.get(left)!;
    let rightNode = pyramid.get(right)!;

    let movingLeft = this.findPath(pyramid, leftNode, target, mult * leftNode.val, path + "L");
    this.allPaths.push(start.id);

    if (movingLeft) {
      this.goodPath.push(start);
      return movingLeft;
    }

    let movingRight = this.findPath(pyramid, rightNode, target, mult * rightNode.val, path + "R");
    this.allPaths.push(start.id);
    if (movingRight) {
      this.goodPath.push(start);
      return movingRight;
    }

    return false;
  }


  findNodePos(node: string) {
    const div = document.getElementById('node-' + node);
    if (div) {
      div.style.transition = 'all 0.9s';
      const { top, left, width, height } = div.getBoundingClientRect();
      return { x: left + window.scrollX, y: top + window.scrollY, w: width, h: height };
    }
    return {};
  }

  changeNodeColor(node: string, color: string = ''){
    if (!color) return;
    const div = document.getElementById('node-' + node);
    if (div) div.style.backgroundColor = color;
  }

  reset() {
    this.target = '';
    this.inputText = '';
    this.outputText = '';

    this.allPaths = [];
    this.connections = [];

    this.goodPath = [];
    this.goodPathFound = false;
    this.unsub.unsubscribe();
  }

  isValid(input: string): boolean {
    if (!input) return false;
    return true;
  }
}
